import { YjsStorageAdapter } from '../yjs-storage'
import * as fs from 'fs-extra'
import * as path from 'path'

describe('YjsStorageAdapter', () => {
  const TEST_DIR = path.join(process.cwd(), 'test-data')
  let storage: YjsStorageAdapter

  beforeEach(async () => {
    // Set up test environment
    process.env.JSON_STORAGE_PATH = TEST_DIR
    storage = new YjsStorageAdapter()
    await fs.ensureDir(TEST_DIR)
  })

  afterEach(async () => {
    // Clean up test data
    await fs.remove(TEST_DIR)
  })

  it('should create and read a document with YJS content', async () => {
    // Create a document
    const doc = await storage.create('documents', {
      title: 'Test Document',
      content: 'Hello, World!',
      userId: 'test-user'
    })

    // Verify the document was created
    expect(doc._id).toBeDefined()
    expect(doc.title).toBe('Test Document')

    // Read the raw file to check YJS state
    const filePath = path.join(TEST_DIR, 'documents', `${doc._id}.json`)
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const savedDoc = JSON.parse(fileContent)

    // Verify YJS structure
    expect(savedDoc.content.type).toBe('yjs')
    expect(Array.isArray(savedDoc.content.state)).toBe(true)

    // Read the document back
    const retrievedDoc = await storage.findById('documents', doc._id)
    expect(retrievedDoc).not.toBeNull()
    expect(retrievedDoc?.content).toBe('Hello, World!')
  })

  it('should update document content using YJS', async () => {
    // Create initial document
    const doc = await storage.create('documents', {
      title: 'Test Document',
      content: 'Initial content',
      userId: 'test-user'
    })

    // Update the document
    const updatedDoc = await storage.update('documents', doc._id, {
      content: 'Updated content'
    })

    // Verify the update
    expect(updatedDoc.content).toBe('Updated content')

    // Read the raw file to verify YJS state was updated
    const filePath = path.join(TEST_DIR, 'documents', `${doc._id}.json`)
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const savedDoc = JSON.parse(fileContent)

    expect(savedDoc.content.type).toBe('yjs')
    expect(Array.isArray(savedDoc.content.state)).toBe(true)

    // Read it back to verify the content
    const retrievedDoc = await storage.findById('documents', doc._id)
    expect(retrievedDoc?.content).toBe('Updated content')
  })

  it('should handle structured content', async () => {
    // Create a document with structured content
    const structuredContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello, World!' }]
        }
      ]
    }

    const doc = await storage.create('documents', {
      title: 'Test Document',
      content: structuredContent,
      userId: 'test-user'
    })

    // Read it back
    const retrievedDoc = await storage.findById('documents', doc._id)
    expect(retrievedDoc).not.toBeNull()
    
    // Content should be stringified JSON
    const parsedContent = JSON.parse(retrievedDoc!.content as string)
    expect(parsedContent).toEqual(structuredContent)
  })
}) 