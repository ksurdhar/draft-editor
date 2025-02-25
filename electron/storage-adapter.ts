import { FileStorageAdapter } from '../lib/storage/file-storage'
import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import { VersionStorage } from '../lib/storage/version-storage'
import * as path from 'path'
import { ObjectId } from 'mongodb'
import * as fs from 'fs-extra'
import { app } from 'electron'

// Read env config to check if we're in local mode
const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const useAppStorage = env.APP_STORAGE || false
// Generate a MongoDB-compatible ID
const generateUUID = () => {
  return new ObjectId().toString()
}

// Set storage path based on mode
const storagePath = useAppStorage 
  ? path.join(app.getPath('userData'), 'data') // Use electron's storage path otherwise
  : path.resolve(process.cwd(), 'data') // Use web app's storage path in local mode 
  

process.env.JSON_STORAGE_PATH = storagePath

// Ensure storage directories exist
fs.ensureDirSync(path.join(storagePath, 'documents'))
fs.ensureDirSync(path.join(storagePath, 'folders'))
fs.ensureDirSync(path.join(storagePath, 'versions'))

console.log('\n=== Storage Adapter Initialization ===')
console.log('Project or app storage:', useAppStorage ? 'app' : 'project')
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

    return newDoc
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

export default documentStorage 