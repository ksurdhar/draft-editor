import * as fs from 'fs-extra'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'

const TEST_DIR = path.join(process.cwd(), 'data', 'documents')

// Sample documents with different content types
const sampleDocs = [
  {
    _id: uuidv4(),
    title: 'Simple Text Document',
    content: 'This is a simple text document.',
    userId: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: uuidv4(),
    title: 'Structured Content Document',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This is a structured document.' }]
        }
      ]
    },
    userId: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: uuidv4(),
    title: 'Already Migrated Document',
    content: {
      type: 'yjs',
      state: [1, 2, 3] // Dummy state
    },
    userId: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

async function createSampleDocs() {
  console.log('\n=== Creating Sample Documents ===')
  
  // Ensure directory exists
  await fs.ensureDir(TEST_DIR)
  
  // Create each sample document
  for (const doc of sampleDocs) {
    const filePath = path.join(TEST_DIR, `${doc._id}.json`)
    await fs.writeFile(filePath, JSON.stringify(doc, null, 2))
    console.log(`Created ${doc.title} at ${filePath}`)
  }

  console.log('\nSample documents created. You can now run the migration script.')
  console.log('Documents directory:', TEST_DIR)
}

// Run the script
createSampleDocs().catch(console.error) 