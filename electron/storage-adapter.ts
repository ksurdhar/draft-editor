import { FileStorageAdapter } from '../lib/storage/file-storage'
import * as path from 'path'
import * as fs from 'fs-extra'
import { app } from 'electron'

// Read env config to check if we're in local mode
const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const useAppStorage = env.APP_STORAGE || false

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

// Create a single storage instance with the appropriate options for Electron
const storage = new FileStorageAdapter({
  storagePath,
  allowCustomIds: true, // Allow custom IDs for syncing with cloud
  parseContentOnUpdate: true, // Parse content on update for document editing
  handleNestedContent: true, // Handle nested content for folder deletion
})

// Export the same instance for different collections to maintain compatibility
export const documentStorage = storage
export const folderStorage = storage
export const versionStorage = storage
export const characterStorage = storage
export const dialogueStorage = storage

export default documentStorage
