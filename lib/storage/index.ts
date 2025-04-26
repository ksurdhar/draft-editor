import { MongoStorageAdapter } from './mongo-storage'

export const storage = new MongoStorageAdapter()

export type { StorageAdapter, Document } from './types'
