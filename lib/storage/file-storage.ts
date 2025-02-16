import fs from 'fs-extra'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { StorageAdapter, Document } from './types'

export class FileStorageAdapter implements StorageAdapter {
  private storagePath: string

  constructor() {
    this.storagePath = process.env.JSON_STORAGE_PATH || './data'
    this.initialize()
  }

  private initialize() {
    const documentsPath = path.join(this.storagePath, 'documents')
    fs.ensureDirSync(documentsPath)
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

  async update(collection: string, id: string, data: Partial<Document>): Promise<Document | null> {
    console.log('\n=== FileStorageAdapter.update ===')
    console.log('Collection:', collection)
    console.log('Document ID:', id)
    console.log('Update data:', data)

    const filePath = this.getDocumentPath(collection, id)
    console.log('File path:', filePath)
    
    if (!fs.existsSync(filePath)) {
      console.log('File not found')
      return null
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const existingDoc = JSON.parse(content) as Document
      console.log('Existing document:', existingDoc)
      
      // Only include defined fields in the update
      const definedUpdates = Object.entries(data).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {} as Record<string, any>)

      const updatedDoc = {
        ...existingDoc,
        ...definedUpdates,
        updatedAt: new Date().toISOString()
      }
      console.log('Updated document:', updatedDoc)

      await fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2))
      console.log('Successfully wrote updated document to file')
      return updatedDoc
    } catch (error) {
      console.error('Error updating document:', error)
      return null
    }
  }

  async delete(collection: string, query: Record<string, any>): Promise<boolean> {
    if (!collection) {
      throw new Error('Collection name is required')
    }

    try {
      const documents = await this.find(collection, query)
      
      if (documents.length === 0) {
        return false
      }

      await Promise.all(
        documents.map(doc => 
          fs.unlink(this.getDocumentPath(collection, doc._id))
        )
      )

      return true
    } catch (error) {
      console.error('Error deleting document:', error)
      return false
    }
  }
} 