import { FileStorageAdapter } from '../lib/storage/file-storage'
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
fs.ensureDirSync(path.join(storagePath, 'characters'))
fs.ensureDirSync(path.join(storagePath, 'dialogue'))

console.log('\n=== Storage Adapter Initialization ===')
console.log('Project or app storage:', useAppStorage ? 'app' : 'project')
console.log('Storage path:', storagePath)
console.log('Documents path:', path.join(storagePath, 'documents'))
console.log('Folders path:', path.join(storagePath, 'folders'))
console.log('Versions path:', path.join(storagePath, 'versions'))
console.log('Characters path:', path.join(storagePath, 'characters'))
console.log('Dialogue path:', path.join(storagePath, 'dialogue'))

// For documents, folders, and versions, we'll use the file-based storage
class ElectronFileStorageAdapter extends FileStorageAdapter {
  async create(collection: string, data: any): Promise<any> {
    if (!collection) {
      throw new Error('Collection name is required')
    }

    const documentsPath = path.join(process.env.JSON_STORAGE_PATH || './data', collection)
    fs.ensureDirSync(documentsPath)

    // Use client-supplied ID if available, otherwise generate a new MongoDB-compatible ID
    const newDoc = {
      ...data,
      _id: data._id || generateUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
      lastUpdated: Date.now(),
    }

    const filePath = path.join(process.env.JSON_STORAGE_PATH || './data', collection, `${id}.json`)
    await fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2))

    return updatedDoc
  }

  async delete(collection: string, query: Record<string, any>): Promise<boolean> {
    console.log('\n=== ElectronFileStorageAdapter.delete ===')
    console.log('Collection:', collection)
    console.log('Query:', query)

    try {
      const documents = await this.find(collection, query)

      if (documents.length === 0) {
        return false
      }

      // If we're deleting folders, we need to handle nested content
      if (collection === 'folders') {
        for (const folder of documents) {
          // Delete all documents in this folder
          await this.find('documents', { parentId: folder._id }).then(docs => {
            docs.forEach(async doc => {
              await this.delete('documents', { _id: doc._id })
            })
          })

          // Delete all nested folders recursively
          await this.find('folders', { parentId: folder._id }).then(async subfolders => {
            for (const subfolder of subfolders) {
              await this.delete('folders', { _id: subfolder._id })
            }
          })

          // Delete the folder file itself
          const filePath = path.join(
            process.env.JSON_STORAGE_PATH || './data',
            collection,
            `${folder._id}.json`,
          )
          await fs.remove(filePath)
        }
      } else {
        // For non-folder collections, just delete the files
        for (const doc of documents) {
          const filePath = path.join(process.env.JSON_STORAGE_PATH || './data', collection, `${doc._id}.json`)
          await fs.remove(filePath)
        }
      }

      return true
    } catch (error) {
      console.error('Error deleting documents:', error)
      return false
    }
  }
}

// Use FileStorage for documents, folders, and versions
const storage = new ElectronFileStorageAdapter()
export const documentStorage = storage
export const folderStorage = storage
export const versionStorage = storage
export const characterStorage = storage
export const dialogueStorage = storage

export default documentStorage
