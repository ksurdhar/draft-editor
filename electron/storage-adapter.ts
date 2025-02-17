import { FileStorageAdapter } from '../lib/storage/file-storage'
import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import { VersionStorage } from '../lib/storage/version-storage'
import { DocumentData, VersionData } from '@typez/globals'
import * as path from 'path'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs-extra'
import { app } from 'electron'

// Constants
const DOCUMENTS_COLLECTION = 'documents'
const FOLDERS_COLLECTION = 'folders'

// Read env config to check if we're in local mode
const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const useLocalDb = env.LOCAL_DB || false

// Generate a UUID using uuid package
const generateUUID = () => {
  return uuidv4()
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

    return newDoc
  }

  async find(collection: string, query: any = {}): Promise<any[]> {
    console.log('\n=== Finding in ElectronYjsStorageAdapter ===')
    console.log('Collection:', collection)
    console.log('Query:', query)

    try {
      // Get documents from parent class
      const documents = await super.find(collection, {})
      console.log('Raw documents from YjsStorageAdapter:', documents.map(doc => ({
        id: doc._id || doc.id,
        title: doc.title,
        parentId: doc.parentId
      })))
      
      // Apply query filters
      const filteredDocs = documents.filter(doc => {
        const matches = Object.entries(query).every(([key, value]) => {
          if (key === '_id' && doc.id) {
            const match = doc.id === value
            console.log(`ID match check for ${doc.id}: ${match}`)
            return match
          }
          const match = doc[key] === value
          console.log(`Field match check for ${key}: ${match}`)
          return match
        })
        console.log(`Document ${doc._id || doc.id} matches query: ${matches}`)
        return matches
      })

      console.log('Found documents:', documents.length)
      console.log('After filtering:', filteredDocs.length)
      console.log('Filtered documents:', filteredDocs.map(doc => ({
        id: doc._id || doc.id,
        title: doc.title,
        parentId: doc.parentId
      })))
      
      return filteredDocs
    } catch (error) {
      console.error('Error finding documents:', error)
      return []
    }
  }

  // Add findById with logging
  async findById(collection: string, id: string): Promise<any> {
    console.log('\n=== Finding by ID in ElectronYjsStorageAdapter ===')
    console.log('Collection:', collection)
    console.log('ID:', id)

    try {
      const doc = await super.findById(collection, id)
      console.log('Found document:', doc ? {
        id: doc._id || doc.id,
        title: doc.title,
        parentId: doc.parentId
      } : 'null')
      return doc
    } catch (error) {
      console.error('Error finding document by ID:', error)
      return null
    }
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

  async find(collection: string, query: any = {}): Promise<any[]> {
    if (!collection) {
      throw new Error('Collection name is required')
    }

    console.log('\n=== Finding in FileStorageAdapter ===')
    console.log('Collection:', collection)
    console.log('Query:', query)

    const documentsPath = path.join(process.env.JSON_STORAGE_PATH || './data', collection)
    fs.ensureDirSync(documentsPath)

    try {
      const files = await fs.readdir(documentsPath)
      const jsonFiles = files.filter(file => file.endsWith('.json'))
      
      console.log('Found files:', jsonFiles.length)

      const documents = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(documentsPath, file)
          const content = await fs.readFile(filePath, 'utf-8')
          return JSON.parse(content)
        })
      )

      // Apply query filters if any
      const filteredDocs = documents.filter(doc => {
        return Object.entries(query).every(([key, value]) => doc[key] === value)
      })

      console.log('Filtered documents:', filteredDocs.length)
      return filteredDocs
    } catch (error) {
      console.error('Error reading documents:', error)
      return []
    }
  }

  async findById(collection: string, id: string): Promise<any> {
    if (!collection || !id) {
      throw new Error('Collection and ID are required')
    }

    const documentsPath = path.join(process.env.JSON_STORAGE_PATH || './data', collection)
    const filePath = path.join(documentsPath, `${id}.json`)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.error('Error reading document:', error)
      return null
    }
  }

  async update(collection: string, id: string, data: any): Promise<any> {
    if (!collection || !id) {
      throw new Error('Collection and ID are required')
    }

    const documentsPath = path.join(process.env.JSON_STORAGE_PATH || './data', collection)
    const filePath = path.join(documentsPath, `${id}.json`)

    try {
      const existingDoc = await this.findById(collection, id)
      if (!existingDoc) {
        throw new Error('Document not found')
      }

      const updatedDoc = {
        ...existingDoc,
        ...data,
        _id: id,
        updatedAt: new Date().toISOString()
      }

      await fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2))
      return updatedDoc
    } catch (error) {
      console.error('Error updating document:', error)
      return null
    }
  }

  async delete(collection: string, query: any): Promise<boolean> {
    if (!collection) {
      throw new Error('Collection name is required')
    }

    const documentsPath = path.join(process.env.JSON_STORAGE_PATH || './data', collection)
    
    if (query._id) {
      // Delete by ID
      const filePath = path.join(documentsPath, `${query._id}.json`)
      try {
        await fs.unlink(filePath)
        return true
      } catch (error) {
        console.error('Error deleting document:', error)
        return false
      }
    } else {
      // Delete by query
      try {
        const documents = await this.find(collection, query)
        await Promise.all(
          documents.map(doc => 
            fs.unlink(path.join(documentsPath, `${doc._id}.json`))
          )
        )
        return true
      } catch (error) {
        console.error('Error deleting documents:', error)
        return false
      }
    }
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

export const makeRequest = async (
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any,
) => {
  console.log('\n=== API Request ===')
  console.log(`Method: ${method.toUpperCase()}`)
  console.log(`Endpoint: ${endpoint}`)
  console.log(`Local DB Mode: ${useLocalDb}`)

  if (useLocalDb) {
    // Clean the endpoint and remove trailing slash
    endpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
    endpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint
    console.log(`Cleaned endpoint: ${endpoint}`)

    // Handle metadata request
    if (endpoint === 'documents/metadata' || endpoint === 'documents') {
      console.log('Handling documents request')
      const documents = await documentStorage.find(DOCUMENTS_COLLECTION, {})
      console.log(`Found ${documents.length} documents`)
      return { data: documents }
    }

    // Handle folder operations
    if (endpoint === 'folders') {
      console.log('Handling collection-level folders request')
      if (method === 'get') {
        const folders = await folderStorage.find(FOLDERS_COLLECTION, {})
        return { data: folders }
      }
      if (method === 'post' && data) {
        const newFolder = await folderStorage.create(FOLDERS_COLLECTION, data)
        return { data: newFolder }
      }
    }

    // Handle document by ID operations
    const documentMatch = endpoint.match(/^documents\/([^\/]+)$/)
    if (documentMatch) {
      const [, id] = documentMatch
      if (id === 'metadata') {
        // Handle metadata request that comes through this path
        const documents = await documentStorage.find(DOCUMENTS_COLLECTION, {})
        return { 
          data: documents.map(doc => ({
            _id: doc._id,
            title: doc.title,
            parentId: doc.parentId,
            folderIndex: doc.folderIndex,
            lastUpdated: doc.lastUpdated,
            userId: doc.userId
          }))
        }
      }

      console.log('Document operation:', { id })
      
      switch (method) {
        case 'get':
          const doc = await documentStorage.findById(DOCUMENTS_COLLECTION, id)
          return { data: doc }
        case 'patch':
          if (!data) return { data: null }
          const updatedDoc = await documentStorage.update(DOCUMENTS_COLLECTION, id, data)
          return { data: updatedDoc }
        case 'delete':
          const success = await documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id })
          return { data: { success } }
      }
    }

    console.log('No matching local operation found')
    return { data: null }
  }

  // For non-local mode (should be handled by your remote API)
  const BASE_URL = 'https://your-api-url.com/api'
  endpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = `${BASE_URL}${endpoint}`

  // Add your remote API handling here
  return { data: null }
}

export default documentStorage 