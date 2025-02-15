import fs from 'fs-extra'
import path from 'path'

interface DatabaseSchema {
  documents: any[];
  [key: string]: any[];
}

async function migrateToFiles() {
  const storagePath = process.env.JSON_STORAGE_PATH || './data'
  const dbPath = path.join(storagePath, 'db.json')
  
  // Check if db.json exists
  if (!fs.existsSync(dbPath)) {
    console.error('db.json not found at:', dbPath)
    process.exit(1)
  }

  try {
    // Read the existing db.json
    console.log('Reading db.json...')
    const dbContent = await fs.readFile(dbPath, 'utf-8')
    const db = JSON.parse(dbContent) as DatabaseSchema

    // Log database structure
    console.log('\nDatabase collections:', Object.keys(db))
    console.log('\nSample counts:')
    Object.entries(db).forEach(([collection, docs]) => {
      console.log(`${collection}: ${docs.length} documents`)
    })

    // Log sample documents from each collection
    console.log('\nSample documents:')
    Object.entries(db).forEach(([collection, docs]) => {
      console.log(`\n${collection} sample (first 2 documents):`)
      console.log(JSON.stringify(docs.slice(0, 2), null, 2))
    })

    // Create directories for each collection
    for (const collection of Object.keys(db)) {
      const collectionPath = path.join(storagePath, collection)
      console.log(`\nCreating directory for ${collection}...`)
      await fs.ensureDir(collectionPath)

      // Migrate each document in the collection
      console.log(`Migrating ${db[collection].length} documents in ${collection}...`)
      for (const doc of db[collection]) {
        const docPath = path.join(collectionPath, `${doc._id}.json`)
        await fs.writeFile(docPath, JSON.stringify(doc, null, 2))
        
        // Log only the first document's path and ID as a sample
        if (db[collection].indexOf(doc) === 0) {
          console.log(`Sample migration:`)
          console.log(`- Document ID: ${doc._id}`)
          console.log(`- Saved to: ${docPath}`)
          console.log(`- Content preview:`, JSON.stringify(doc).slice(0, 150) + '...')
        }
      }
    }

    // Backup the original db.json
    const backupPath = path.join(storagePath, 'db.json.backup')
    console.log('\nCreating backup of db.json...')
    await fs.copy(dbPath, backupPath)

    // Remove the original db.json
    console.log('Removing original db.json...')
    await fs.remove(dbPath)

    console.log('\nMigration completed successfully!')
    console.log('A backup of your original db.json has been saved as db.json.backup')
  } catch (error) {
    console.error('Error during migration:', error)
    process.exit(1)
  }
}

migrateToFiles() 