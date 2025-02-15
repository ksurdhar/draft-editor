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
    if (!collection) {
      throw new Error('Collection name is required')
    }

    const documentsPath = this.getDocumentsPath(collection)
    fs.ensureDirSync(documentsPath)

    const newDoc: Document = {
      ...data,
      _id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const filePath = this.getDocumentPath(collection, newDoc._id)
    await fs.writeFile(filePath, JSON.stringify(newDoc, null, 2))

    return newDoc
  }

  async findById(collection: string, id: string): Promise<Document | null> {
    const filePath = this.getDocumentPath(collection, id)
    
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as Document
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
    const filePath = this.getDocumentPath(collection, id)
    
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const existingDoc = JSON.parse(content) as Document
      
      const updatedDoc = {
        ...existingDoc,
        ...data,
        updatedAt: new Date().toISOString()
      }

      await fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2))
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