import { FileStorageAdapter } from './file-storage'

console.log('\n=== Web Storage Initialization ===')
console.log('Storage Type: Local with Cloud Sync')
console.log('MOCK_AUTH:', process.env.MOCK_AUTH)

// We always use the file storage adapter for local operations
// Cloud operations are handled at the API service level
export const storage = new FileStorageAdapter()

export type { StorageAdapter, Document } from './types' 