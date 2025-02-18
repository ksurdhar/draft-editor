import { FileStorageAdapter } from '../lib/storage/file-storage'
import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import { MongoStorageAdapter } from '../lib/storage/mongo-storage'
import { VersionStorage } from '../lib/storage/version-storage'
import { SyncService } from './sync-service'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import { app } from 'electron'

// Read env config to check if we're in local mode
const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const useLocalDb = env.LOCAL_DB || false

// Generate a UUID using Node's crypto module
const generateUUID = () => {
  return crypto.randomUUID()
}

// Set storage path based on mode
const storagePath = useLocalDb 
  ? path.resolve(process.cwd(), 'data') // Use web app's storage path in local mode
  : path.join(app.getPath('userData'), 'data') // Use electron's storage path otherwise

process.env.JSON_STORAGE_PATH = storagePath

// Ensure storage directories exist
fs.ensureDirSync(path.join(storagePath, 'documents'))
fs.ensureDirSync(path.join(storagePath, 'folders'))
fs.ensureDirSync(path.join(storagePath, 'versions'))

console.log('\n=== Storage Adapter Initialization ===')
console.log('Storage mode:', useLocalDb ? 'local (web)' : 'electron')
console.log('Storage path:', storagePath)
console.log('Documents path:', path.join(storagePath, 'documents'))
console.log('Folders path:', path.join(storagePath, 'folders'))
console.log('Versions path:', path.join(storagePath, 'versions'))

// Create a custom storage adapter that uses generateUUID for IDs
class ElectronYjsStorageAdapter extends YjsStorageAdapter {
  async create(collection: string, data: any): Promise<any> {
    if (!collection) {
      throw new Error('Collection name is required')
    }

    const newDoc = await super.create(collection, {
      ...data,
      _id: generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    // Queue for sync if we're in sync mode
    if (syncService) {
      syncService.queueForSync(newDoc._id)
    }

    return newDoc
  }

  async update(collection: string, id: string, data: any): Promise<any> {
    const result = await super.update(collection, id, data)
    
    // Queue for sync if we're in sync mode
    if (syncService && result) {
      syncService.queueForSync(id)
    }

    return result
  }
}

// For folders, we'll still use the file-based storage
class ElectronFileStorageAdapter extends FileStorageAdapter {
  async create(collection: string, data: any): Promise<any> {
    if (!collection) {
      throw new Error('Collection name is required')
    }

    const documentsPath = path.join(process.env.JSON_STORAGE_PATH || './data', collection)
    fs.ensureDirSync(documentsPath)

    const newDoc = {
      ...data,
      _id: generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const filePath = path.join(documentsPath, `${newDoc._id}.json`)
    await fs.writeFile(filePath, JSON.stringify(newDoc, null, 2))

    return newDoc
  }
}

// Create a custom version storage adapter that uses generateUUID for IDs
class ElectronVersionStorage extends VersionStorage {
  generateId() {
    return generateUUID()
  }
}

// Use YJS for documents, file storage for folders
export const documentStorage = new ElectronYjsStorageAdapter()
export const folderStorage = new ElectronFileStorageAdapter()
export const versionStorage = new ElectronVersionStorage()

// Initialize MongoDB storage without sync
const mongoStorage = !useLocalDb ? new MongoStorageAdapter({
  dbName: env.DB_NAME,
  dbCluster: env.DB_CLUSTER,
  dbUser: env.DB_USER,
  dbPass: env.DB_PASS
}) : null

// Create sync service but don't initialize it yet
export let syncService: SyncService | null = !useLocalDb ? new SyncService(documentStorage, mongoStorage!) : null

// Function to initialize sync service after authentication
export async function initializeSyncService() {
  if (syncService) {
    try {
      await syncService.initialize()
      console.log('Sync service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize sync service:', error)
      // Don't throw the error - we'll retry on subsequent operations
    }
  }
}

export default documentStorage 