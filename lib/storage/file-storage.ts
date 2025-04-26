import fs from 'fs-extra'
import path from 'path'
import { ObjectId } from 'mongodb'
import { StorageAdapter, Document } from './types'
import os from 'os'

export interface FileStorageOptions {
  storagePath?: string // Path where files should be stored
  allowCustomIds?: boolean // Allow client-supplied IDs during creation
  parseContentOnUpdate?: boolean // Attempt to parse content as JSON in update
  handleNestedContent?: boolean // Handle nested content for folders on delete
}

export class FileStorageAdapter implements StorageAdapter {
  private storagePath: string
  private options: Required<FileStorageOptions>

  constructor(options: FileStorageOptions = {}) {
    // Set default options
    this.options = {
      storagePath:
        process.env.JSON_STORAGE_PATH ||
        (process.env.NODE_ENV === 'production' ? path.join(os.tmpdir(), 'draft-editor-data') : './data'),
      allowCustomIds: false,
      parseContentOnUpdate: false,
      handleNestedContent: false,
      ...options,
    }

    this.storagePath = this.options.storagePath

    console.log('\n=== FileStorageAdapter Initialization ===')
    console.log('Environment:', process.env.NODE_ENV)
    console.log('Storage path:', this.storagePath)
    console.log('Options:', JSON.stringify(this.options, null, 2))

    this.initialize()
  }

  private initialize() {
    // Ensure both the base storage path and documents directory exist
    fs.ensureDirSync(this.storagePath)
    const documentsPath = path.join(this.storagePath, 'documents')
    fs.ensureDirSync(documentsPath)
    console.log('Initialized storage directories:', {
      base: this.storagePath,
      documents: documentsPath,
    })
  }

  private getDocumentsPath(collection: string) {
    if (!collection) {
      throw new Error('Collection name is required')
    }
    return path.join(this.storagePath, collection)
  }

  private getDocumentPath(collection: string, id: string) {
    if (!collection || !id) {
      throw new Error('Collection name and document ID are required')
    }
    return path.join(this.getDocumentsPath(collection), `${id}.json`)
  }

  // Generate a MongoDB-compatible ID
  private generateUUID() {
    return new ObjectId().toString()
  }

  async create(collection: string, data: Omit<Document, '_id'>): Promise<Document> {
    console.log('\n=== FileStorageAdapter.create ===')
    console.log('Collection:', collection)
    console.log('Input data:', data)

    if (!collection) {
      throw new Error('Collection name is required')
    }

    const documentsPath = this.getDocumentsPath(collection)
    fs.ensureDirSync(documentsPath)
    console.log('Documents path:', documentsPath)

    // Use client-supplied ID if allowed and available, otherwise generate a new ID
    const docId = this.options.allowCustomIds && (data as any)._id ? (data as any)._id : this.generateUUID()

    const newDoc: Document = {
      ...data,
      _id: docId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    console.log('Created new document:', newDoc)

    if (!newDoc._id) {
      throw new Error('Document ID is undefined')
    }

    const filePath = this.getDocumentPath(collection, newDoc._id)
    console.log('Writing to file path:', filePath)
    await fs.writeFile(filePath, JSON.stringify(newDoc, null, 2))
    console.log('Successfully wrote document to file')

    return newDoc
  }

  async findById(collection: string, id: string): Promise<Document | null> {
    console.log('\n=== FileStorageAdapter.findById ===')
    console.log('Collection:', collection)
    console.log('Document ID:', id)

    const filePath = this.getDocumentPath(collection, id)
    console.log('Looking for file:', filePath)

    if (!fs.existsSync(filePath)) {
      console.log('File not found')
      return null
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const doc = JSON.parse(content) as Document
      // console.log('Found document:', doc)
      return doc
    } catch (error) {
      console.error('Error reading document:', error)
      return null
    }
  }

  async find(collection: string, query: Record<string, any> = {}): Promise<Document[]> {
    const documentsPath = this.getDocumentsPath(collection)
    if (!fs.existsSync(documentsPath)) {
      return []
    }

    try {
      const files = await fs.readdir(documentsPath)
      const documents = await Promise.all(
        files.map(async file => {
          if (!file.endsWith('.json')) return null
          const content = await fs.readFile(path.join(documentsPath, file), 'utf-8')
          return JSON.parse(content) as Document
        }),
      )

      return documents.filter(
        (doc): doc is Document =>
          doc !== null && Object.entries(query).every(([key, value]) => doc[key] === value),
      )
    } catch (error) {
      console.error('Error reading documents:', error)
      return []
    }
  }

  async update(collection: string, id: string, data: any) {
    try {
      const doc = await this.findById(collection, id)
      if (!doc) {
        throw new Error(`Document not found: ${id}`)
      }

      // Parse content if needed and it's provided as a string
      let parsedData = { ...data }
      if (this.options.parseContentOnUpdate && data.content) {
        if (typeof data.content === 'string') {
          try {
            parsedData.content = JSON.parse(data.content)
          } catch (e) {
            console.error('Error parsing content:', e)
            // Keep content as string if parsing fails
          }
        }
      }

      const updatedDoc = {
        ...doc,
        ...parsedData,
        updatedAt: new Date().toISOString(),
        lastUpdated: Date.now(),
      }

      if (!updatedDoc._id) {
        throw new Error('Document ID is undefined')
      }

      const filePath = this.getDocumentPath(collection, updatedDoc._id)
      await fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2))
      return updatedDoc
    } catch (error) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  async delete(collection: string, query: Record<string, any>): Promise<boolean> {
    console.log('\n=== FileStorageAdapter.delete ===')
    console.log('Collection:', collection)
    console.log('Query:', query)

    try {
      const documents = await this.find(collection, query)

      if (documents.length === 0) {
        return false
      }

      // If we're deleting folders and handleNestedContent is enabled, we need to handle nested content
      if (collection === 'folders' && this.options.handleNestedContent) {
        for (const folder of documents) {
          await this.handleFolderDeletion(folder)
        }
      } else {
        // For non-folder collections or when handleNestedContent is disabled, just delete the files
        await Promise.all(
          documents.map(doc => {
            if (!doc._id) {
              throw new Error('Document ID is undefined')
            }
            return fs.unlink(this.getDocumentPath(collection, doc._id))
          }),
        )
      }

      return true
    } catch (error) {
      console.error('Error deleting documents:', error)
      return false
    }
  }

  // Helper method to handle folder deletion with nested content
  private async handleFolderDeletion(folder: Document): Promise<void> {
    if (!folder._id) {
      throw new Error('Folder ID is undefined')
    }

    // Delete all documents in this folder
    const docs = await this.find('documents', { parentId: folder._id })
    for (const doc of docs) {
      if (doc._id) {
        await fs.remove(this.getDocumentPath('documents', doc._id))
      }
    }

    // Delete all nested folders recursively
    const subfolders = await this.find('folders', { parentId: folder._id })
    for (const subfolder of subfolders) {
      await this.handleFolderDeletion(subfolder)
    }

    // Delete the folder file itself
    await fs.remove(this.getDocumentPath('folders', folder._id))
  }
}
