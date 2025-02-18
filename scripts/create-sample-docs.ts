import * as fs from 'fs-extra'
import * as path from 'path'
import * as crypto from 'crypto'

const DATA_DIR = path.join(__dirname, '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')

const createSampleDocument = (title: string) => {
  const id = crypto.randomUUID()
  const doc = {
    _id: id,
    title,
    content: `This is a sample document with ID: ${id}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  return doc
}

const main = async () => {
  // Ensure directories exist
  await fs.ensureDir(DATA_DIR)
  await fs.ensureDir(DOCUMENTS_DIR)

  // Create sample documents
  const documents = [
    createSampleDocument('Sample Document 1'),
    createSampleDocument('Sample Document 2'),
    createSampleDocument('Sample Document 3')
  ]

  // Write documents to files
  for (const doc of documents) {
    const filePath = path.join(DOCUMENTS_DIR, `${doc._id}.json`)
    await fs.writeFile(filePath, JSON.stringify(doc, null, 2))
    console.log(`Created document: ${filePath}`)
  }
}

main().catch(console.error) 