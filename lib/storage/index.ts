import { FileStorageAdapter } from './file-storage'
import { VersionStorage } from './version-storage'

export const storage = new FileStorageAdapter()
export const versionStorage = new VersionStorage()

export type { StorageAdapter, Document } from './types' 