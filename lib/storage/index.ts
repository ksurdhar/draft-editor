import { FileStorageAdapter } from './file-storage'
import { VersionStorage } from './version-storage'
import { MongoStorageAdapter } from './mongo-storage'

console.log('\n=== Web Storage Initialization ===')
console.log('Storage Type:', process.env.NEXT_PUBLIC_STORAGE_TYPE)
console.log('LOCAL_DB:', process.env.LOCAL_DB)
console.log('MOCK_AUTH:', process.env.MOCK_AUTH)

export const storage = process.env.NEXT_PUBLIC_STORAGE_TYPE === 'mongo'
  ? new MongoStorageAdapter()
  : new FileStorageAdapter()

export const versionStorage = new VersionStorage()

export type { StorageAdapter, Document } from './types' 