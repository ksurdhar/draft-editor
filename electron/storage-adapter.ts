import { FileStorageAdapter } from '../lib/storage/file-storage'
import { VersionStorage } from '../lib/storage/version-storage'
import fs from 'fs-extra'
import * as path from 'path'
import { app } from 'electron'

// Read env config to check if we're in local mode
const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const useLocalDb = env.LOCAL_DB || false

// Set storage path based on mode
const storagePath = useLocalDb 
  ? path.resolve(process.cwd(), 'data') // Use web app's storage path in local mode
  : path.join(app.getPath('userData'), 'data') // Use electron's storage path otherwise

process.env.JSON_STORAGE_PATH = storagePath
// console.log('Storage mode:', useLocalDb ? 'local (web)' : 'electron')
// console.log('Storage path:', storagePath)
// console.log('User data path:', app.getPath('userData'))
// console.log('Web storage path:', path.resolve(process.cwd(), 'data'))

// Ensure storage directories exist
fs.ensureDirSync(path.join(storagePath, 'documents'))
fs.ensureDirSync(path.join(storagePath, 'folders'))
fs.ensureDirSync(path.join(storagePath, 'versions'))

// Initialize storage adapters
console.log('\n=== Storage Adapter Initialization ===')
console.log('Storage mode:', useLocalDb ? 'local (web)' : 'electron')
console.log('Storage path:', storagePath)
console.log('Documents path:', path.join(storagePath, 'documents'))
console.log('Folders path:', path.join(storagePath, 'folders'))
console.log('Versions path:', path.join(storagePath, 'versions'))

export const documentStorage = new FileStorageAdapter()
export const versionStorage = new VersionStorage()

// Log initial content for debugging
const logStorageContent = async () => {
  console.log('\n=== Initial Storage Content ===')
  try {
    const docs = await documentStorage.find('documents', {})
    const folders = await documentStorage.find('folders', {})
    console.log('Documents count:', docs.length)
    console.log('Folders count:', folders.length)
    console.log('Document IDs:', docs.map(d => d._id))
    console.log('Folder IDs:', folders.map(f => f._id))
  } catch (error) {
    console.error('Error reading initial storage content:', error)
  }
}
logStorageContent()

export default documentStorage 