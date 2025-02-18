import { MongoClient } from 'mongodb'
import { StorageAdapter, Document } from './types'
import * as crypto from 'crypto'

interface MongoConfig {
  dbName: string
  dbCluster: string
  dbUser: string
  dbPass: string
}

export class MongoStorageAdapter implements StorageAdapter {
  private client: MongoClient
  private dbName: string
  private connected = false
  private userId: string | null = null

  constructor(config: MongoConfig) {
    const uri = `mongodb+srv://${config.dbUser}:${config.dbPass}@${config.dbCluster}.mongodb.net`
    console.log('Initializing MongoDB connection:', uri.replace(config.dbPass, '[REDACTED]'))
    this.client = new MongoClient(uri)
    this.dbName = config.dbName
  }

  setUserId(userId: string) {
    this.userId = userId
  }

  private async connect() {
    if (!this.connected) {
      await this.client.connect()
      this.connected = true
      console.log('Connected to MongoDB')
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.client.close()
      this.connected = false
      console.log('Disconnected from MongoDB')
    }
  }

  private async getCollection(collection: string) {
    await this.connect()
    return this.client.db(this.dbName).collection<Document>(collection)
  }

  private toMongoDoc(data: Partial<Document>): Partial<Document> {
    const doc: Record<string, unknown> = { ...data }
    
    if (data.createdAt) {
      doc.createdAt = new Date(data.createdAt)
    }
    if (data.updatedAt) {
      doc.updatedAt = new Date(data.updatedAt)
    }
    return doc as Partial<Document>
  }

  private toDocument(doc: Document): Document {
    const createdAt = doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt
    const updatedAt = doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt
    
    return {
      ...doc,
      _id: doc._id,
      createdAt,
      updatedAt
    }
  }

  async create(collection: string, data: Omit<Document, '_id'>): Promise<Document> {
    console.log('\n=== MongoStorageAdapter.create ===')
    console.log('Collection:', collection)
    console.log('Data:', data)

    if (!this.userId && collection === 'documents') {
      throw new Error('User ID is required to create documents')
    }

    try {
      const col = await this.getCollection(collection)
      const mongoDoc = {
        ...this.toMongoDoc(data),
        _id: crypto.randomUUID(),
        userId: this.userId,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Document

      await col.insertOne(mongoDoc)
      return this.toDocument(mongoDoc)
    } catch (error) {
      console.error('Error creating document:', error)
      throw error
    }
  }

  async findById(collection: string, id: string): Promise<Document | null> {
    console.log('\n=== MongoStorageAdapter.findById ===')
    console.log('Collection:', collection)
    console.log('ID:', id)

    try {
      const col = await this.getCollection(collection)
      const query = collection === 'documents' && this.userId
        ? { _id: id, userId: this.userId }
        : { _id: id }
      const result = await col.findOne(query)
      return result ? this.toDocument(result) : null
    } catch (error) {
      console.error('Error finding document:', error)
      throw error
    }
  }

  async find(collection: string, query: Record<string, any> = {}): Promise<Document[]> {
    console.log('\n=== MongoStorageAdapter.find ===')
    console.log('Collection:', collection)
    console.log('Query:', query)
    console.log('User ID:', this.userId)

    try {
      const col = await this.getCollection(collection)
      const finalQuery = collection === 'documents' && this.userId
        ? { ...query, userId: this.userId }
        : query
      console.log('Final MongoDB query:', finalQuery)
      const results = await col.find(finalQuery).toArray()
      console.log(`Found ${results.length} documents in MongoDB`)
      if (results.length > 0) {
        console.log('MongoDB document IDs:', results.map(doc => doc._id))
      }
      return results.map(doc => this.toDocument(doc))
    } catch (error) {
      console.error('Error finding documents:', error)
      throw error
    }
  }

  async update(collection: string, id: string, data: Partial<Document>): Promise<Document | null> {
    console.log('\n=== MongoStorageAdapter.update ===')
    console.log('Collection:', collection)
    console.log('ID:', id)
    console.log('Update data:', data)

    try {
      const col = await this.getCollection(collection)
      const query = collection === 'documents' && this.userId
        ? { _id: id, userId: this.userId }
        : { _id: id }
      const mongoUpdate = {
        ...this.toMongoDoc(data),
        updatedAt: new Date()
      }
      
      const result = await col.findOneAndUpdate(
        query,
        { $set: mongoUpdate },
        { returnDocument: 'after' }
      )

      return result ? this.toDocument(result) : null
    } catch (error) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  async delete(collection: string, query: Record<string, any>): Promise<boolean> {
    console.log('\n=== MongoStorageAdapter.delete ===')
    console.log('Collection:', collection)
    console.log('Query:', query)

    try {
      const col = await this.getCollection(collection)
      const finalQuery = collection === 'documents' && this.userId
        ? { ...query, userId: this.userId }
        : query
      console.log('Final query:', finalQuery)
      const result = await col.deleteMany(finalQuery)
      return result.deletedCount > 0
    } catch (error) {
      console.error('Error deleting documents:', error)
      throw error
    }
  }
} 