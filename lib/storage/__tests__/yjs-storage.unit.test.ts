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
    // Create a document with Tiptap format
    const doc = await storage.create('documents', {
      title: 'Test Document',
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello, World!' }]
        }]
      },
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
    expect(retrievedDoc!.content).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello, World!' }]
      }]
    })
  })

  it('should update document content using YJS', async () => {
    // Create initial document with Tiptap format
    const doc = await storage.create('documents', {
      title: 'Test Document',
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Initial content' }]
        }]
      },
      userId: 'test-user'
    })

    // Update the document with new Tiptap content
    const updatedDoc = await storage.update('documents', doc._id, {
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated content' }]
        }]
      }
    })

    // Verify the update
    expect(updatedDoc.content).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Updated content' }]
      }]
    })

    // Read the raw file to verify YJS state was updated
    const filePath = path.join(TEST_DIR, 'documents', `${doc._id}.json`)
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const savedDoc = JSON.parse(fileContent)

    expect(savedDoc.content.type).toBe('yjs')
    expect(Array.isArray(savedDoc.content.state)).toBe(true)

    // Read it back to verify the content
    const retrievedDoc = await storage.findById('documents', doc._id)
    expect(retrievedDoc).not.toBeNull()
    expect(retrievedDoc!.content).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Updated content' }]
      }]
    })
  })

  it('should handle structured content', async () => {
    // Create a document with structured Tiptap content
    const structuredContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph' }]
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
    
    // Content should be Tiptap JSON
    expect(retrievedDoc!.content).toEqual(structuredContent)
  })

  it('should handle empty paragraphs', async () => {
    // Test cases for different empty paragraph scenarios
    const testCases = [
      {
        name: 'empty paragraph with no content array',
        input: {
          type: 'doc',
          content: [{
            type: 'paragraph'
          }]
        },
        expected: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: ' ' }]
          }]
        }
      },
      {
        name: 'empty paragraph with empty content array',
        input: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: []
          }]
        },
        expected: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: ' ' }]
          }]
        }
      },
      {
        name: 'multiple empty paragraphs',
        input: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [] },
            { type: 'paragraph' }
          ]
        },
        expected: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: ' ' }] },
            { type: 'paragraph', content: [{ type: 'text', text: ' ' }] }
          ]
        }
      }
    ]

    for (const testCase of testCases) {
      console.log(`Testing: ${testCase.name}`)
      
      const doc = await storage.create('documents', {
        title: 'Test Document',
        content: testCase.input,
        userId: 'test-user'
      })

      // Read it back
      const retrievedDoc = await storage.findById('documents', doc._id)
      expect(retrievedDoc).not.toBeNull()
      
      // Content should match expected structure
      expect(retrievedDoc!.content).toEqual(testCase.expected)
    }
  })
}) 