import * as fs from 'fs-extra'
import * as path from 'path'
import * as Y from 'yjs'

const DOCUMENTS_DIR = process.env.JSON_STORAGE_PATH || path.resolve(process.cwd(), 'data', 'documents')

async function rollbackFromYjs() {
  console.log('\n=== Starting Rollback from YJS ===')
  console.log('Reading documents from:', DOCUMENTS_DIR)

  try {
    // Ensure the documents directory exists
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      console.log('No documents directory found. Nothing to rollback.')
      return
    }

    // Read all JSON files in the documents directory
    const files = await fs.readdir(DOCUMENTS_DIR)
    const jsonFiles = files.filter(file => file.endsWith('.json'))
    
    console.log(`Found ${jsonFiles.length} documents to check for rollback`)
    
    let processed = 0
    let rolledBack = 0
    let skipped = 0
    let failed = 0

    for (const file of jsonFiles) {
      const filePath = path.join(DOCUMENTS_DIR, file)
      processed++
      
      try {
        // Read the JSON file
        const content = await fs.readFile(filePath, 'utf-8')
        const document = JSON.parse(content)

        // Skip if not in YJS format
        if (!document.content || typeof document.content !== 'object' || document.content.type !== 'yjs' || !Array.isArray(document.content.state)) {
          console.log(`Skipping ${file}: not in YJS format`)
          skipped++
          continue
        }

        console.log(`\nRolling back ${file}...`)

        // Create a backup before modifying
        const backupDir = path.join(DOCUMENTS_DIR, 'yjs_backup')
        await fs.ensureDir(backupDir)
        await fs.copyFile(filePath, path.join(backupDir, file))
        console.log(`Backup created in ${backupDir}/${file}`)

        // Convert YJS state back to content
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(document.content.state))
        const ytext = ydoc.getText('content')
        const contentStr = ytext.toString()
        
        // Try to parse content as JSON first (TipTap structure)
        let originalContent
        try {
          originalContent = JSON.parse(contentStr)
          console.log('Successfully parsed content back to JSON format')
        } catch (e) {
          // If not valid JSON, store as string
          console.log('Content is not valid JSON, storing as string')
          originalContent = contentStr
        }

        // Update the document with original content format
        document.content = originalContent

        // Save the rollback document
        await fs.writeFile(filePath, JSON.stringify(document, null, 2))
        console.log(`Successfully rolled back ${file}`)
        rolledBack++
      } catch (error) {
        console.error(`Failed to rollback ${file}:`, error)
        failed++
      }
    }

    console.log('\n=== Rollback Summary ===')
    console.log(`Total documents processed: ${processed}`)
    console.log(`Successfully rolled back: ${rolledBack}`)
    console.log(`Skipped (not in YJS format): ${skipped}`)
    console.log(`Failed: ${failed}`)
    
    if (rolledBack > 0) {
      console.log('\nOriginal YJS files have been backed up to:', path.join(DOCUMENTS_DIR, 'yjs_backup'))
    }
    
    console.log('\n=== Rollback Complete ===')

  } catch (error) {
    console.error('Rollback failed:', error)
    process.exit(1)
  }
}

// Run the rollback
rollbackFromYjs().catch(err => {
  console.error('Unhandled error during rollback:', err)
  process.exit(1)
}) 