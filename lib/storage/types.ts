import { ObjectId } from 'mongodb'

// Base interface for all documents
export interface BaseDocument {
  _id?: string
  createdAt?: string | Date
  updatedAt?: string | Date
}

// Interface for documents as they are stored in MongoDB
export interface MongoDocument {
  _id?: ObjectId
  createdAt: Date
  updatedAt: Date
  [key: string]: unknown
}

// Interface for documents as they are stored in JSON files
export interface JsonDocument {
  _id: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

// Interface for documents as they are used in the application
export interface Document extends BaseDocument {
  [key: string]: unknown
}

// Generic storage adapter interface
export interface StorageAdapter {
  create(collection: string, data: any): Promise<any>
  find(collection: string, query: any, options?: { projection?: Record<string, number> }): Promise<any[]>
  findById(collection: string, id: string): Promise<any>
  update(collection: string, id: string, data: any): Promise<any>
  delete(collection: string, query: Record<string, any>): Promise<boolean>
}
