import { type Low } from 'lowdb'
import { JSONPreset } from 'lowdb/node'
import path from 'path'
import fs from 'fs-extra'
import { StorageAdapter, Document, JsonDocument } from './types'
import { v4 as uuidv4 } from 'uuid'

interface DatabaseSchema {
  [collection: string]: JsonDocument[];
}

export class JsonStorageAdapter implements StorageAdapter {
  private db!: Low<DatabaseSchema>
  private storagePath: string
  private initPromise: Promise<void>

  constructor() {
    this.storagePath = process.env.JSON_STORAGE_PATH || './data'
    this.initPromise = this.initialize()
  }

  private async initialize() {
    try {
      fs.ensureDirSync(this.storagePath)
      const file = path.join(this.storagePath, 'db.json')
      this.db = await JSONPreset<DatabaseSchema>(file, {})
    } catch (error) {
      console.error('Error initializing JsonStorageAdapter:', error)
      throw error
    }
  }

  private async ensureCollection(collection: string) {
    try {
      await this.initPromise
      const data = this.db.data
      if (!data[collection]) {
        data[collection] = []
        await this.db.write()
      }
    } catch (error) {
      console.error('Error ensuring collection:', error)
      throw error
    }
  }

  private toJsonDoc(data: Partial<Document>): Partial<JsonDocument> {
    const doc: Record<string, unknown> = { ...data }
    if (data.createdAt) {
      doc.createdAt = new Date(data.createdAt).toISOString()
    }
    if (data.updatedAt) {
      doc.updatedAt = new Date(data.updatedAt).toISOString()
    }
    return doc as Partial<JsonDocument>
  }

  private toDocument(doc: JsonDocument): Document {
    return {
      ...doc,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }
  }

  async create(collection: string, data: Omit<Document, '_id'>): Promise<Document> {
    try {
      await this.initPromise
      await this.ensureCollection(collection)
      
      const jsonDoc = {
        ...this.toJsonDoc(data),
        _id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as JsonDocument
      
      this.db.data[collection].push(jsonDoc)
      await this.db.write()
      
      return this.toDocument(jsonDoc)
    } catch (error) {
      console.error('Error creating document:', error)
      throw error
    }
  }

  async findById(collection: string, id: string): Promise<Document | null> {
    try {
      await this.initPromise
      await this.ensureCollection(collection)
      const doc = this.db.data[collection].find(doc => doc._id === id)
      return doc ? this.toDocument(doc) : null
    } catch (error) {
      console.error('Error finding document by id:', error)
      throw error
    }
  }

  async find(collection: string, query: object = {}): Promise<Document[]> {
    try {
      await this.initPromise
      await this.ensureCollection(collection)
      return this.db.data[collection]
        .filter(doc => {
          return Object.entries(query).every(([key, value]) => doc[key] === value)
        })
        .map(doc => this.toDocument(doc))
    } catch (error) {
      console.error('Error finding documents:', error)
      throw error
    }
  }

  async update(collection: string, id: string, data: Partial<Document>): Promise<Document | null> {
    try {
      await this.initPromise
      await this.ensureCollection(collection)
      const index = this.db.data[collection].findIndex(doc => doc._id === id)
      if (index === -1) return null

      const existingDoc = this.db.data[collection][index]
      const updatedDoc = {
        ...existingDoc,
        ...this.toJsonDoc(data),
        updatedAt: new Date().toISOString()
      } as JsonDocument

      this.db.data[collection][index] = updatedDoc
      await this.db.write()
      
      return this.toDocument(updatedDoc)
    } catch (error) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  async delete(collection: string, query: Record<string, any>): Promise<boolean> {
    try {
      await this.initPromise
      await this.ensureCollection(collection)
      const initialLength = this.db.data[collection].length
      this.db.data[collection] = this.db.data[collection].filter(doc => 
        !(doc._id === query._id && doc.userId === query.userId)
      )
      const deleted = initialLength !== this.db.data[collection].length
      
      if (deleted) {
        await this.db.write()
      }
      
      return deleted
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }
} 