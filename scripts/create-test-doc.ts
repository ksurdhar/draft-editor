import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import * as fs from 'fs-extra'
import * as path from 'path'

async function createTestDoc() {
  const TEST_DIR = path.join(process.cwd(), 'test-data')
  process.env.JSON_STORAGE_PATH = TEST_DIR
  
  const storage = new YjsStorageAdapter()
  await fs.ensureDir(path.join(TEST_DIR, 'documents'))

  const doc = await storage.create('documents', {
    title: 'Example Document',
    content: 'Hello YJS!',
    userId: 'test'
  })

  console.log('Document created:', doc._id)
  
  // Read and display the raw file
  const filePath = path.join(TEST_DIR, 'documents', `${doc._id}.json`)
  const fileContent = await fs.readFile(filePath, 'utf-8')
  console.log('\nStored JSON file:')
  console.log(fileContent)
}

createTestDoc() 