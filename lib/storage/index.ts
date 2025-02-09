import { StorageAdapter } from './types'
import { JsonStorageAdapter } from './json-storage'
import { MongoStorageAdapter } from './mongo-storage'

export function getStorageAdapter(): StorageAdapter {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'mongodb'
  
  switch (storageType.toLowerCase()) {
    case 'json':
      return new JsonStorageAdapter()
    case 'mongodb':
      return new MongoStorageAdapter()
    default:
      throw new Error(`Unsupported storage type: ${storageType}`)
  }
}

// Export types
export * from './types'

// Create a singleton instance
export const storage = getStorageAdapter() 