import fs from 'fs-extra'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { StorageAdapter, Document } from './types'
import os from 'os'

export class FileStorageAdapter implements StorageAdapter {
  private storagePath: string

  constructor() {
    // In production, use the system's temp directory
    // In development, use the configured path or ./data
    this.storagePath = process.env.NODE_ENV === 'production'
      ? path.join(os.tmpdir(), 'draft-editor-data')
      : (process.env.JSON_STORAGE_PATH || './data')
    
    console.log('\n=== FileStorageAdapter Initialization ===')
    console.log('Environment:', process.env.NODE_ENV)
    console.log('Storage path:', this.storagePath)
    
    this.initialize()
  }

  private initialize() {
    // Ensure both the base storage path and documents directory exist
    fs.ensureDirSync(this.storagePath)
    const documentsPath = path.join(this.storagePath, 'documents')
    fs.ensureDirSync(documentsPath)
    console.log('Initialized storage directories:', {
      base: this.storagePath,
      documents: documentsPath
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

    const newDoc: Document = {
      ...data,
      _id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
      console.log('Found document:', doc)
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
        files.map(async (file) => {
          if (!file.endsWith('.json')) return null
          const content = await fs.readFile(path.join(documentsPath, file), 'utf-8')
          return JSON.parse(content) as Document
        })
      )

      return documents
        .filter((doc): doc is Document => 
          doc !== null && 
          Object.entries(query).every(([key, value]) => doc[key] === value)
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

      const updatedDoc = { ...doc, ...data }
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

      await Promise.all(
        documents.map(doc => {
          if (!doc._id) {
            throw new Error('Document ID is undefined')
          }
          return fs.unlink(this.getDocumentPath(collection, doc._id))
        })
      )

      return true
    } catch (error) {
      console.error('Error deleting documents:', error)
      return false
    }
  }
} 