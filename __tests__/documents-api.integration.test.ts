import axios from 'axios'
import { Doc } from '@lib/mongo-models'
import { mockUser } from '../lib/mock-auth'
import * as Y from 'yjs'
import { startTestServer, stopTestServer } from './test-utils/server'

const API_URL = 'http://localhost:3000/api'

describe('Documents API Integration Tests', () => {
  beforeAll(async () => {
    console.log('Starting test server...')
    await startTestServer()
    console.log('Test server started')
  })

  afterAll(async () => {
    console.log('Stopping test server...')
    await stopTestServer()
    console.log('Test server stopped')
  })

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
      // Create a proper YJS document state
      const ydoc = new Y.Doc()
      const ytext = ydoc.getText('content')
      ytext.insert(0, 'Test content')
      const state = Y.encodeStateAsUpdate(ydoc)

      // Create a test document with proper YJS state
      const testDoc = await Doc.create({
        title: 'Test Doc',
        content: {
          type: 'yjs',
          state: Array.from(state)
        },
        userId: mockUser.sub
      })

      const response = await axios.get(`${API_URL}/documents`)
      
      const data = response.data
      expect(data).toHaveLength(1)
      expect(data[0]).toHaveProperty('content')
      expect(data[0].content).toBe('Test content')
      expect(data[0].id).toBe(testDoc._id.toString())
      expect(data[0].title).toBe('Test Doc')
    }, 10000)

    it('should return documents without content when metadataOnly=true', async () => {
      // Create a proper YJS document state
      const ydoc = new Y.Doc()
      const ytext = ydoc.getText('content')
      ytext.insert(0, 'Test content')
      const state = Y.encodeStateAsUpdate(ydoc)

      // Create a test document with proper YJS state
      const testDoc = await Doc.create({
        title: 'Test Doc',
        content: {
          type: 'yjs',
          state: Array.from(state)
        },
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
      // Create multiple test documents
      const docs = await Promise.all([
        Doc.create({
          title: 'Doc 1',
          content: {
            type: 'yjs',
            state: Array.from(createYjsState('Content 1'))
          },
          userId: mockUser.sub
        }),
        Doc.create({
          title: 'Doc 2',
          content: {
            type: 'yjs',
            state: Array.from(createYjsState('Content 2'))
          },
          userId: mockUser.sub
        }),
        Doc.create({
          title: 'Doc 3',
          content: {
            type: 'yjs',
            state: Array.from(createYjsState('Content 3'))
          },
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
      expect(data.map((d: any) => d.content)).toEqual(['Content 1', 'Content 3'])
    }, 10000)

    it('should fetch documents without content when metadataOnly is true', async () => {
      const doc = await Doc.create({
        title: 'Test Doc',
        content: {
          type: 'yjs',
          state: Array.from(createYjsState('Test Content'))
        },
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
})

// Helper function to create YJS state
function createYjsState(content: string): Uint8Array {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText('content')
  ytext.insert(0, content)
  return Y.encodeStateAsUpdate(ydoc)
} 