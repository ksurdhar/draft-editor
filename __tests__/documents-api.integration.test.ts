import axios from 'axios'
import { Doc, Folder } from '@lib/mongo-models'
import { mockUser } from '../lib/mock-auth'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const API_URL = 'http://localhost:3000/api'

async function isPortInUse(port: number): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
      return stdout.includes(`:${port}`)
    } else {
      const { stdout } = await execAsync(`lsof -i :${port} -t`)
      return !!stdout.trim()
    }
  } catch {
    return false
  }
}

async function killServer() {
  if (!await isPortInUse(3000)) return

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('netstat -ano | findstr :3000')
      const match = stdout.match(/\s+(\d+)\s*$/m)
      if (match) {
        const pid = match[1]
        console.log(`Cleaning up server process ${pid}...`)
        await execAsync(`taskkill /F /PID ${pid}`)
      }
    } else {
      try {
        const { stdout } = await execAsync('lsof -i :3000 -t')
        if (stdout.trim()) {
          const pid = stdout.trim()
          console.log(`Cleaning up server process ${pid}...`)
          try {
            await execAsync(`kill ${pid}`)
            await new Promise(resolve => setTimeout(resolve, 1000))
          } catch {
            await execAsync(`kill -9 ${pid}`)
          }
        }
      } catch {
        try {
          const { stdout } = await execAsync('fuser 3000/tcp')
          if (stdout.trim()) {
            const pid = stdout.trim()
            console.log(`Cleaning up server process ${pid}...`)
            await execAsync(`kill -9 ${pid}`)
          }
        } catch {
          // Ignore if no process found
        }
      }
    }

    // Verify cleanup
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (await isPortInUse(3000)) {
      console.warn('Warning: Port 3000 still in use after cleanup attempt')
    }
  } catch (error) {
    console.error('Error during server cleanup:', error)
  }
}

describe('Documents API Integration Tests', () => {
  // Ensure server cleanup happens after all tests, regardless of outcome
  afterAll(async () => {
    await killServer()
    // Give extra time for process cleanup
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, 15000)

  describe('GET /api/documents', () => {
    beforeEach(async () => {
      // Clear the documents collection before each test
      await Doc.deleteMany({})
    }, 10000)

    afterAll(async () => {
      // Clean up all test data
      await Doc.deleteMany({})
    }, 10000)

    it('should return all documents with content when metadataOnly is not set', async () => {
      // Create a test document with stringified JSON content
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Test content' }
            ]
          }
        ]
      }

      // Create a test document with stringified JSON
      const testDoc = await Doc.create({
        title: 'Test Doc',
        content: JSON.stringify(content),
        userId: mockUser.sub
      })

      const response = await axios.get(`${API_URL}/documents`)
      
      const data = response.data
      expect(data).toHaveLength(1)
      expect(data[0]).toHaveProperty('content')
      expect(data[0].content).toEqual(content)
      expect(data[0].id).toBe(testDoc._id.toString())
      expect(data[0].title).toBe('Test Doc')
    }, 10000)

    it('should return documents without content when metadataOnly=true', async () => {
      // Create a test document with stringified JSON content
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Test content' }
            ]
          }
        ]
      }

      // Create a test document with stringified JSON
      const testDoc = await Doc.create({
        title: 'Test Doc',
        content: JSON.stringify(content),
        userId: mockUser.sub
      })

      const response = await axios.get(`${API_URL}/documents?metadataOnly=true`)
      
      const data = response.data
      expect(data).toHaveLength(1)
      expect(data[0].content).toBeUndefined()
      expect(data[0].id).toBe(testDoc._id.toString())
      expect(data[0].title).toBe('Test Doc')
    }, 10000)

    it('should handle empty document list', async () => {
      const response = await axios.get(`${API_URL}/documents`)
      expect(response.data).toHaveLength(0)
    }, 10000)
  })

  describe('POST /api/documents/bulk-fetch', () => {
    beforeEach(async () => {
      // Clear the documents collection before each test
      await Doc.deleteMany({})
    }, 10000)

    afterAll(async () => {
      // Clean up all test data
      await Doc.deleteMany({})
    }, 10000)

    it('should fetch multiple documents with content', async () => {
      // Create test documents with stringified JSON content
      const createContent = (text: string) => ({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text }
            ]
          }
        ]
      })

      // Create multiple test documents
      const docs = await Promise.all([
        Doc.create({
          title: 'Doc 1',
          content: JSON.stringify(createContent('Content 1')),
          userId: mockUser.sub
        }),
        Doc.create({
          title: 'Doc 2',
          content: JSON.stringify(createContent('Content 2')),
          userId: mockUser.sub
        }),
        Doc.create({
          title: 'Doc 3',
          content: JSON.stringify(createContent('Content 3')),
          userId: mockUser.sub
        })
      ])

      // Fetch only the first and third documents
      const response = await axios.post(`${API_URL}/documents/bulk-fetch`, {
        ids: [docs[0]._id, docs[2]._id]
      })
      
      const data = response.data
      expect(data).toHaveLength(2)
      expect(data.map((d: any) => d.title)).toEqual(['Doc 1', 'Doc 3'])
      
      // Verify content objects
      expect(data[0].content.type).toBe('doc')
      expect(data[0].content.content[0].content[0].text).toBe('Content 1')
      expect(data[1].content.type).toBe('doc')
      expect(data[1].content.content[0].content[0].text).toBe('Content 3')
    }, 10000)

    it('should fetch documents without content when metadataOnly is true', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Test Content' }
            ]
          }
        ]
      }

      const doc = await Doc.create({
        title: 'Test Doc',
        content: JSON.stringify(content),
        userId: mockUser.sub
      })

      const response = await axios.post(`${API_URL}/documents/bulk-fetch`, {
        ids: [doc._id],
        metadataOnly: true
      })
      
      const data = response.data
      expect(data).toHaveLength(1)
      expect(data[0].content).toBeUndefined()
      expect(data[0].id).toBe(doc._id.toString())
      expect(data[0].title).toBe('Test Doc')
    }, 10000)

    it('should handle invalid document IDs gracefully', async () => {
      const response = await axios.post(`${API_URL}/documents/bulk-fetch`, {
        ids: ['invalid-id', '']
      })
      .catch(error => error.response)

      expect(response.status).toBe(400)
      expect(response.data.error).toBe('No valid document IDs provided')
    }, 10000)

    it('should validate ids is an array', async () => {
      const response = await axios.post(`${API_URL}/documents/bulk-fetch`, {
        ids: 'not-an-array'
      })
      .catch(error => error.response)

      expect(response.status).toBe(400)
      expect(response.data.error).toBe('ids must be an array')
    }, 10000)

    it('should handle empty ids array', async () => {
      const response = await axios.post(`${API_URL}/documents/bulk-fetch`, {
        ids: []
      })
      .catch(error => error.response)

      expect(response.status).toBe(400)
      expect(response.data.error).toBe('No document IDs provided')
    }, 10000)
  })

  describe('POST /api/documents', () => {
    beforeEach(async () => {
      // Clear the documents collection before each test
      await Doc.deleteMany({})
    }, 10000)

    afterAll(async () => {
      // Clean up all test data
      await Doc.deleteMany({})
    }, 10000)

    it('should create a new document with JSON content', async () => {
      const documentData = {
        title: 'New Test Document',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'Hello, world!' }
              ]
            }
          ]
        }
      }

      const response = await axios.post(`${API_URL}/documents`, documentData)
      
      // Verify response
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('_id')
      expect(response.data.title).toBe('New Test Document')
      expect(response.data.content).toEqual(documentData.content)
      
      // Verify document was saved in database
      const savedDoc = await Doc.findById(response.data._id)
      expect(savedDoc).not.toBeNull()
      expect(savedDoc?.title).toBe('New Test Document')
      
      // Verify content was stored as stringified JSON
      expect(typeof savedDoc?.content).toBe('string')
      const parsedContent = JSON.parse(savedDoc?.content as string)
      expect(parsedContent).toEqual(documentData.content)
    }, 10000)

    it('should create a document with default content when no content is provided', async () => {
      const documentData = {
        title: 'Document Without Content'
      }

      const response = await axios.post(`${API_URL}/documents`, documentData)
      
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('_id')
      expect(response.data.title).toBe('Document Without Content')
      expect(response.data.content).toBeTruthy()
      
      // Verify document was saved
      const savedDoc = await Doc.findById(response.data._id)
      expect(savedDoc).not.toBeNull()
      
      // Verify content was stored as stringified JSON
      expect(typeof savedDoc?.content).toBe('string')
      // Should be able to parse the content
      expect(() => JSON.parse(savedDoc?.content as string)).not.toThrow()
    }, 10000)

    it('should handle string content by ensuring it is valid JSON', async () => {
      const documentData = {
        title: 'Document With String Content',
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'String content test' }] }]
        })
      }

      const response = await axios.post(`${API_URL}/documents`, documentData)
      
      expect(response.status).toBe(200)
      expect(response.data.title).toBe('Document With String Content')
      
      // Content should be parsed in the response
      expect(typeof response.data.content).toBe('object')
      expect(response.data.content.type).toBe('doc')
      
      // Verify document was saved with stringified content
      const savedDoc = await Doc.findById(response.data._id)
      expect(typeof savedDoc?.content).toBe('string')
    }, 10000)
  })

  describe('POST /api/documents/bulk-delete', () => {
    beforeEach(async () => {
      // Clear the documents and folders collections before each test
      await Promise.all([
        Doc.deleteMany({}),
        Folder.deleteMany({})
      ])
    }, 10000)

    afterAll(async () => {
      // Clean up all test data
      await Promise.all([
        Doc.deleteMany({}),
        Folder.deleteMany({})
      ])
    }, 10000)

    it('should delete multiple documents', async () => {
      // Create test documents
      const docs = await Promise.all([
        Doc.create({
          title: 'Doc to Delete 1',
          content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content 1' }] }] }),
          userId: mockUser.sub
        }),
        Doc.create({
          title: 'Doc to Delete 2',
          content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content 2' }] }] }),
          userId: mockUser.sub
        }),
        Doc.create({
          title: 'Doc to Keep',
          content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content 3' }] }] }),
          userId: mockUser.sub
        })
      ])

      // Delete the first two documents
      const response = await axios.post(`${API_URL}/documents/bulk-delete`, {
        documentIds: [docs[0]._id.toString(), docs[1]._id.toString()],
        folderIds: []
      })

      // Verify response
      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)

      // Verify documents were deleted
      const remainingDocs = await Doc.find({})
      expect(remainingDocs.length).toBe(1)
      expect(remainingDocs[0]._id.toString()).toBe(docs[2]._id.toString())
    }, 10000)

    it('should handle empty arrays', async () => {
      const response = await axios.post(`${API_URL}/documents/bulk-delete`, {
        documentIds: [],
        folderIds: []
      })

      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)
    }, 10000)

    it('should validate request body', async () => {
      const response = await axios.post(`${API_URL}/documents/bulk-delete`, {
        documentIds: 'not-an-array',
        folderIds: []
      })
      .catch(error => error.response)

      expect(response.status).toBe(400)
      expect(response.data.error).toBe('Invalid request body')
    }, 10000)

    it('should delete folders and their contents recursively', async () => {
      // Create a folder structure with documents
      const rootFolder = await Folder.create({
        title: 'Root Folder',
        userId: mockUser.sub,
        parentId: 'root'
      })

      const subFolder = await Folder.create({
        title: 'Sub Folder',
        userId: mockUser.sub,
        parentId: rootFolder._id.toString()
      })

      // Create documents in both folders
      await Promise.all([
        Doc.create({
          title: 'Doc in Root',
          content: JSON.stringify({ type: 'doc', content: [] }),
          userId: mockUser.sub,
          parentId: rootFolder._id.toString()
        }),
        Doc.create({
          title: 'Doc in Sub',
          content: JSON.stringify({ type: 'doc', content: [] }),
          userId: mockUser.sub,
          parentId: subFolder._id.toString()
        })
      ])

      // Delete the root folder (should cascade to subfolder and all docs)
      const response = await axios.post(`${API_URL}/documents/bulk-delete`, {
        documentIds: [],
        folderIds: [rootFolder._id.toString()]
      })

      // Verify response
      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)

      // Verify everything was deleted
      const remainingFolders = await Folder.find({})
      const remainingDocs = await Doc.find({})
      
      expect(remainingFolders.length).toBe(0)
      expect(remainingDocs.length).toBe(0)
    }, 15000)
  })
}) 