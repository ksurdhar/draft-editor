import { FileStorageAdapter } from '../lib/storage/file-storage'
import { VersionStorage } from '../lib/storage/version-storage'
import { VersionData } from '@typez/globals'
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

// For documents and folders, we'll use the file-based storage
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

  async update(collection: string, id: string, data: any): Promise<any> {
    const doc = await this.findById(collection, id)
    if (!doc) {
      throw new Error(`Document not found: ${id}`)
    }

    // Parse content if it's provided as a string
    let parsedData = { ...data }
    if (data.content) {
      if (typeof data.content === 'string') {
        try {
          parsedData.content = JSON.parse(data.content)
        } catch (e) {
          console.error('Error parsing content:', e)
          // Keep content as string if parsing fails
        }
      }
    }

    const updatedDoc = { 
      ...doc, 
      ...parsedData,
      updatedAt: new Date().toISOString(),
      lastUpdated: Date.now()
    }

    const filePath = path.join(process.env.JSON_STORAGE_PATH || './data', collection, `${id}.json`)
    await fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2))

    return updatedDoc
  }
}

// Create a custom version storage adapter that uses generateUUID for IDs
class ElectronVersionStorage extends VersionStorage {
  generateId() {
    return generateUUID()
  }

  async createVersion(version: Omit<VersionData, 'id'>): Promise<VersionData> {
    const newVersion = {
      ...version,
      id: this.generateId(),
      createdAt: Date.now()
    }

    // Parse content if it's provided as a string
    if (typeof newVersion.content === 'string') {
      try {
        newVersion.content = JSON.parse(newVersion.content)
      } catch (e) {
        console.error('Error parsing content:', e)
        // Keep content as string if parsing fails
      }
    }

    const filePath = path.join(process.env.JSON_STORAGE_PATH || './data', 'versions', `${newVersion.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(newVersion, null, 2))

    return newVersion
  }

  async getVersions(documentId: string): Promise<VersionData[]> {
    const versionsPath = path.join(process.env.JSON_STORAGE_PATH || './data', 'versions')
    
    if (!fs.existsSync(versionsPath)) {
      return []
    }

    const files = await fs.readdir(versionsPath)
    const versions = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          const filePath = path.join(versionsPath, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const version = JSON.parse(content)
          return version
        })
    )

    // Filter versions for this document and sort by title
    const documentVersions = versions
      .filter(version => version.documentId === documentId)
      .sort((a, b) => a.title.localeCompare(b.title))

    return documentVersions
  }

  async deleteVersion(documentId: string, versionId: string): Promise<boolean> {
    const filePath = path.join(process.env.JSON_STORAGE_PATH || './data', 'versions', `${versionId}.json`)

    if (!fs.existsSync(filePath)) {
      return false
    }

    await fs.remove(filePath)
    return true
  }
}

// Use FileStorage for both documents and folders
export const documentStorage = new ElectronFileStorageAdapter()
export const folderStorage = new ElectronFileStorageAdapter()
export const versionStorage = new ElectronVersionStorage()

export default documentStorage 