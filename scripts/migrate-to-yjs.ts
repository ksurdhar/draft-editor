import * as fs from 'fs-extra'
import * as path from 'path'
import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import { Document } from '../lib/storage/types'

const DOCUMENTS_DIR = process.env.JSON_STORAGE_PATH || path.resolve(process.cwd(), 'data', 'documents')

async function migrateToYjs() {
  console.log('\n=== Starting Migration to YJS ===')
  console.log('Reading documents from:', DOCUMENTS_DIR)

  // Create YJS storage adapter
  const yjsStorage = new YjsStorageAdapter()

  try {
    // Ensure the documents directory exists
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      console.log('No documents directory found. Nothing to migrate.')
      return
    }

    // Read all JSON files in the documents directory
    const files = await fs.readdir(DOCUMENTS_DIR)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    console.log(`Found ${jsonFiles.length} documents to migrate`)

    // Migrate each document
    for (const file of jsonFiles) {
      const filePath = path.join(DOCUMENTS_DIR, file)
      console.log(`\nMigrating ${file}...`)

      try {
        // Read the JSON file
        const content = await fs.readFile(filePath, 'utf-8')
        const document = JSON.parse(content) as Document

        // Skip if already migrated
        if (document.content && typeof document.content === 'object' && 'type' in document.content && document.content.type === 'yjs') {
          console.log('Document already in YJS format, skipping...')
          continue
        }

        // Create new document with same ID
        const newDoc = {
          ...document,
          // Preserve the original _id
          _id: document._id,
          // Keep original dates
          createdAt: document.createdAt,
          updatedAt: document.updatedAt,
          // Ensure content is properly formatted
          content: typeof document.content === 'string' 
            ? document.content 
            : JSON.stringify(document.content)
        }

        // Store in YJS
        await yjsStorage.create('documents', newDoc)
        
        console.log(`Successfully migrated ${file}`)

        // Backup the original file
        const backupDir = path.join(DOCUMENTS_DIR, 'json_backup')
        await fs.ensureDir(backupDir)
        await fs.move(filePath, path.join(backupDir, file))
      } catch (error) {
        console.error(`Failed to migrate ${file}:`, error)
        // Continue with next file
      }
    }

    console.log('\n=== Migration Complete ===')
    console.log(`Successfully migrated ${jsonFiles.length} documents`)
    console.log('Original JSON files have been moved to:', path.join(DOCUMENTS_DIR, 'json_backup'))

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
migrateToYjs() 