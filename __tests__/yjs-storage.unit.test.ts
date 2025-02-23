import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import * as fs from 'fs-extra'
import * as path from 'path'
import { YjsContent } from '../lib/storage/types'

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

  it('should create and read a document with string content', async () => {
    // Create a document with plain string content
    const doc = await storage.create('documents', {
      title: 'Test Document',
      content: 'Hello, World!',
      userId: 'test-user'
    })

    // Verify the document was created
    expect(doc._id).toBeDefined()
    expect(doc.title).toBe('Test Document')
    expect(doc.content).toBe('Hello, World!')

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

  it('should create and read a document with explicit YJS content', async () => {
    // Create a document with YJS content
    const yjsContent: YjsContent = {
      type: 'yjs',
      content: 'Initial YJS content',
      state: []
    }

    const doc = await storage.create('documents', {
      title: 'YJS Document',
      content: yjsContent,
      userId: 'test-user',
      isYjsContent: true
    })

    // Verify the document was created
    expect(doc._id).toBeDefined()
    expect(doc.title).toBe('YJS Document')
    expect(doc.content).toEqual(yjsContent)

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
    expect(retrievedDoc?.content).toBe('Initial YJS content')
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
    
    // Content should be the same object
    expect(retrievedDoc?.content).toEqual(structuredContent)
  })

  it('should handle structured content as YJS content', async () => {
    // Create a document with structured content in YJS format
    const structuredContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello, World!' }]
        }
      ]
    }

    const yjsContent: YjsContent = {
      type: 'yjs',
      content: structuredContent,
      state: []
    }

    const doc = await storage.create('documents', {
      title: 'Test Document',
      content: yjsContent,
      userId: 'test-user',
      isYjsContent: true
    })

    // Read it back
    const retrievedDoc = await storage.findById('documents', doc._id)
    expect(retrievedDoc).not.toBeNull()
    
    // Content should be the same object
    expect(retrievedDoc?.content).toEqual(structuredContent)
  })
}) 