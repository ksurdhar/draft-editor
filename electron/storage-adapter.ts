import { FileStorageAdapter } from '../lib/storage/file-storage'
import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import { VersionStorage } from '../lib/storage/version-storage'
import * as path from 'path'
import { ObjectId } from 'mongodb'
import * as fs from 'fs-extra'
import { app } from 'electron'

// Read env config based on environment
const envPath = process.env.NODE_ENV === 'test' 
  ? path.join(process.cwd(), 'env-electron.test.json')
  : path.resolve(__dirname, '../../env-electron.json')

console.log('\n=== Storage Adapter Environment ===')
console.log('Environment:', process.env.NODE_ENV)
console.log('Config path:', envPath)

const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const useAppStorage = env.APP_STORAGE || false

// Set storage path based on environment
const storagePath = process.env.NODE_ENV === 'test'
  ? process.env.JSON_STORAGE_PATH || path.join(process.cwd(), 'test-data') // Use test path
  : useAppStorage 
    ? path.join(app.getPath('userData'), 'data') // Use electron's storage path
    : path.join(process.cwd(), 'data') // Use web app's storage path

// Ensure storage path is absolute
const absoluteStoragePath = path.isAbsolute(storagePath) 
  ? storagePath 
  : path.join(process.cwd(), storagePath)

process.env.JSON_STORAGE_PATH = absoluteStoragePath

// Ensure storage directories exist
fs.ensureDirSync(path.join(absoluteStoragePath, 'documents'))
fs.ensureDirSync(path.join(absoluteStoragePath, 'folders'))
fs.ensureDirSync(path.join(absoluteStoragePath, 'versions'))

console.log('\n=== Storage Adapter Initialization ===')
console.log('Project or app storage:', useAppStorage ? 'app' : 'project')
console.log('Storage path:', absoluteStoragePath)
console.log('Documents path:', path.join(absoluteStoragePath, 'documents'))
console.log('Folders path:', path.join(absoluteStoragePath, 'folders'))
console.log('Versions path:', path.join(absoluteStoragePath, 'versions'))

// Generate a MongoDB-compatible ID
const generateUUID = () => {
  return new ObjectId().toString()
}

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