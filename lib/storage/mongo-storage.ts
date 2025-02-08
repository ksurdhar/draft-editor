import { MongoClient, ObjectId } from 'mongodb'
import { StorageAdapter, Document, MongoDocument } from './types'

export class MongoStorageAdapter implements StorageAdapter {
  private client: MongoClient
  private dbName: string
  private connected = false

  constructor() {
    const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}`
    this.client = new MongoClient(uri)
    this.dbName = process.env.DB_NAME || 'whetstone'
  }

  private async connect() {
    if (!this.connected) {
      await this.client.connect()
      this.connected = true
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.client.close()
      this.connected = false
    }
  }

  private async getCollection(collection: string) {
    await this.connect()
    return this.client.db(this.dbName).collection<MongoDocument>(collection)
  }

  private toMongoDoc(data: Partial<Document>): Partial<MongoDocument> {
    const doc: Record<string, unknown> = { ...data }
    delete doc._id // Remove string _id if it exists
    
    if (data._id) {
      // Add ObjectId _id if string _id existed
      doc._id = new ObjectId(data._id)
    }
    if (data.createdAt) {
      doc.createdAt = new Date(data.createdAt)
    }
    if (data.updatedAt) {
      doc.updatedAt = new Date(data.updatedAt)
    }
    return doc as Partial<MongoDocument>
  }

  private toDocument(doc: MongoDocument): Document {
    return {
      ...doc,
      _id: doc._id?.toString(),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString()
    }
  }

  async create(collection: string, data: Omit<Document, '_id'>): Promise<Document> {
    try {
      const col = await this.getCollection(collection)
      const mongoDoc = {
        ...this.toMongoDoc(data),
        createdAt: new Date(),
        updatedAt: new Date()
      } as MongoDocument

      const result = await col.insertOne(mongoDoc)
      return this.toDocument({ ...mongoDoc, _id: result.insertedId })
    } catch (error) {
      console.error('Error creating document:', error)
      throw error
    }
  }

  async findById(collection: string, id: string): Promise<Document | null> {
    try {
      const col = await this.getCollection(collection)
      const result = await col.findOne({ _id: new ObjectId(id) } as any)
      return result ? this.toDocument(result) : null
    } catch (error) {
      console.error('Error finding document by id:', error)
      throw error
    }
  }

  async find(collection: string, query: object = {}): Promise<Document[]> {
    try {
      const col = await this.getCollection(collection)
      const results = await col.find(query).toArray()
      return results.map(doc => this.toDocument(doc))
    } catch (error) {
      console.error('Error finding documents:', error)
      throw error
    }
  }

  async update(collection: string, id: string, data: Partial<Document>): Promise<Document | null> {
    try {
      const col = await this.getCollection(collection)
      const mongoUpdate = {
        ...this.toMongoDoc(data),
        updatedAt: new Date()
      }
      
      const result = await col.findOneAndUpdate(
        { _id: new ObjectId(id) } as any,
        { $set: mongoUpdate },
        { returnDocument: 'after' }
      )
      return result ? this.toDocument(result) : null
    } catch (error) {
      console.error('Error updating document:', error)
      throw error
    }
  }

  async delete(collection: string, id: string): Promise<boolean> {
    try {
      const col = await this.getCollection(collection)
      const result = await col.deleteOne({ _id: new ObjectId(id) } as any)
      return result.deletedCount === 1
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }
} 