import axios from 'axios'
import { Doc, Version } from '@lib/mongo-models'
import { mockUser } from '../lib/mock-auth'
import mongoose from 'mongoose'

const API_URL = 'http://localhost:3000/api'

describe('Versions API Integration Tests', () => {
  // Only clean up test data after all tests, don't stop the server
  afterAll(async () => {
    // Clean up all test data
    await Promise.all([
      Doc.deleteMany({}),
      Version.deleteMany({})
    ])
  }, 10000)

  describe('GET /api/documents/[id]/versions', () => {
    let testDoc: any

    beforeEach(async () => {
      // Clear the documents and versions collections before each test
      await Promise.all([
        Doc.deleteMany({}),
        Version.deleteMany({})
      ])

      // Create a test document
      testDoc = await Doc.create({
        title: 'Test Document for Versions',
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original content' }] }]
        }),
        userId: mockUser.sub
      })
    }, 10000)

    afterAll(async () => {
      // Clean up all test data
      await Promise.all([
        Doc.deleteMany({}),
        Version.deleteMany({})
      ])
    }, 10000)

    it('should return an empty array when no versions exist', async () => {
      const response = await axios.get(`${API_URL}/documents/${testDoc._id}/versions`)
      
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBe(0)
    }, 10000)

    it('should return all versions for a document with parsed content', async () => {
      // Create some versions for the test document
      const version1Content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version 1 content' }] }]
      }
      
      const version2Content = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version 2 content' }] }]
      }

      // Create versions directly in the database
      await Promise.all([
        Version.create({
          documentId: testDoc._id.toString(),
          ownerId: mockUser.sub,
          name: 'Version 1',
          content: JSON.stringify(version1Content),
          createdAt: Date.now() - 1000,
          wordCount: 3
        }),
        Version.create({
          documentId: testDoc._id.toString(),
          ownerId: mockUser.sub,
          name: 'Version 2',
          content: JSON.stringify(version2Content),
          createdAt: Date.now(),
          wordCount: 3
        })
      ])

      const response = await axios.get(`${API_URL}/documents/${testDoc._id}/versions`)
      
      expect(response.status).toBe(200)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBe(2)
      
      // Find versions by name in the response
      const version1 = response.data.find((v: any) => v.name === 'Version 1')
      const version2 = response.data.find((v: any) => v.name === 'Version 2')
      
      // Verify both versions exist
      expect(version1).toBeDefined()
      expect(version2).toBeDefined()
      
      // Content should be parsed from JSON string to object
      expect(typeof version1.content).toBe('object')
      expect(version1.content.type).toBe('doc')
      expect(version1.content.content[0].content[0].text).toBe('Version 1 content')
      
      expect(typeof version2.content).toBe('object')
      expect(version2.content.type).toBe('doc')
      expect(version2.content.content[0].content[0].text).toBe('Version 2 content')
    }, 10000)

    it('should return 404 for non-existent document', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString()
      const response = await axios.get(`${API_URL}/documents/${nonExistentId}/versions`)
        .catch(error => error.response)
      
      expect(response.status).toBe(404)
      expect(response.data.error).toBe('Document not found')
    }, 10000)

    it('should return 403 for document owned by another user', async () => {
      // Create a document owned by a different user
      const otherUserDoc = await Doc.create({
        title: 'Other User Document',
        content: JSON.stringify({ type: 'doc', content: [] }),
        userId: 'different-user-id' // Not the mock user
      })

      const response = await axios.get(`${API_URL}/documents/${otherUserDoc._id}/versions`)
        .catch(error => error.response)
      
      expect(response.status).toBe(403)
      expect(response.data.error).toBe('Not authorized to access this document')
    }, 10000)
  })

  describe('POST /api/documents/[id]/versions', () => {
    let testDoc: any

    beforeEach(async () => {
      // Clear the documents and versions collections before each test
      await Promise.all([
        Doc.deleteMany({}),
        Version.deleteMany({})
      ])

      // Create a test document
      testDoc = await Doc.create({
        title: 'Test Document for Creating Versions',
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original content' }] }]
        }),
        userId: mockUser.sub
      })
    }, 10000)

    afterAll(async () => {
      // Clean up all test data
      await Promise.all([
        Doc.deleteMany({}),
        Version.deleteMany({})
      ])
    }, 10000)

    it('should create a new version with object content', async () => {
      const versionData = {
        name: 'New Version',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New version content' }] }]
        }
      }

      const response = await axios.post(`${API_URL}/documents/${testDoc._id}/versions`, versionData)
      
      expect(response.status).toBe(200)
      expect(response.data).toHaveProperty('id')
      expect(response.data.name).toBe('New Version')
      expect(response.data.documentId).toBe(testDoc._id.toString())
      expect(response.data.ownerId).toBe(mockUser.sub)
      
      // Content should be returned as an object
      expect(typeof response.data.content).toBe('object')
      expect(response.data.content.type).toBe('doc')
      expect(response.data.content.content[0].content[0].text).toBe('New version content')
      
      // Verify version was saved in database
      const savedVersion = await Version.findById(response.data.id)
      expect(savedVersion).not.toBeNull()
      expect(savedVersion?.name).toBe('New Version')
      
      // Content should be stored as a string in the database
      expect(typeof savedVersion?.content).toBe('string')
      const parsedContent = JSON.parse(savedVersion?.content as string)
      expect(parsedContent).toEqual(versionData.content)
    }, 10000)

    it('should create a new version with string content', async () => {
      const contentString = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'String content version' }] }]
      })

      const versionData = {
        name: 'String Content Version',
        content: contentString
      }

      const response = await axios.post(`${API_URL}/documents/${testDoc._id}/versions`, versionData)
      
      expect(response.status).toBe(200)
      expect(response.data.name).toBe('String Content Version')
      
      // Content should be returned as an object
      expect(typeof response.data.content).toBe('object')
      expect(response.data.content.type).toBe('doc')
      
      // Verify version was saved in database
      const savedVersion = await Version.findById(response.data.id)
      expect(savedVersion).not.toBeNull()
      
      // Content should be stored as a string in the database
      expect(typeof savedVersion?.content).toBe('string')
      expect(() => JSON.parse(savedVersion?.content as string)).not.toThrow()
    }, 10000)

    it('should handle non-JSON string content', async () => {
      const versionData = {
        name: 'Plain Text Version',
        content: 'This is plain text, not JSON'
      }

      const response = await axios.post(`${API_URL}/documents/${testDoc._id}/versions`, versionData)
      
      expect(response.status).toBe(200)
      expect(response.data.name).toBe('Plain Text Version')
      
      // Verify version was saved in database
      const savedVersion = await Version.findById(response.data.id)
      expect(savedVersion).not.toBeNull()
      
      // Content should be stored as a string in the database
      expect(typeof savedVersion?.content).toBe('string')
      
      // The string should be wrapped in JSON
      const parsedContent = JSON.parse(savedVersion?.content as string)
      expect(parsedContent).toBe('This is plain text, not JSON')
    }, 10000)

    it('should require content in the request', async () => {
      const versionData = {
        name: 'Missing Content Version'
        // content is missing
      }

      const response = await axios.post(`${API_URL}/documents/${testDoc._id}/versions`, versionData)
        .catch(error => error.response)
      
      expect(response.status).toBe(400)
      expect(response.data.error).toBe('Content is required')
    }, 10000)

    it('should return 404 for non-existent document', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString()
      const response = await axios.post(`${API_URL}/documents/${nonExistentId}/versions`, {
        name: 'Version for Non-existent Doc',
        content: { type: 'doc', content: [] }
      })
        .catch(error => error.response)
      
      expect(response.status).toBe(404)
      expect(response.data.error).toBe('Document not found')
    }, 10000)
  })

  describe('DELETE /api/documents/[id]/versions', () => {
    let testDoc: any
    let testVersion: any

    beforeEach(async () => {
      // Clear the documents and versions collections before each test
      await Promise.all([
        Doc.deleteMany({}),
        Version.deleteMany({})
      ])

      // Create a test document
      testDoc = await Doc.create({
        title: 'Test Document for Deleting Versions',
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Original content' }] }]
        }),
        userId: mockUser.sub
      })

      // Create a test version
      testVersion = await Version.create({
        documentId: testDoc._id.toString(),
        ownerId: mockUser.sub,
        name: 'Version to Delete',
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Version content' }] }]
        }),
        createdAt: Date.now(),
        wordCount: 2
      })
    }, 10000)

    afterAll(async () => {
      // Clean up all test data
      await Promise.all([
        Doc.deleteMany({}),
        Version.deleteMany({})
      ])
    }, 10000)

    it('should delete a version by ID', async () => {
      const response = await axios.delete(`${API_URL}/documents/${testDoc._id}/versions?versionId=${testVersion._id}`)
      
      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)
      
      // Verify version was deleted from database
      const deletedVersion = await Version.findById(testVersion._id)
      expect(deletedVersion).toBeNull()
    }, 10000)

    it('should require a version ID', async () => {
      const response = await axios.delete(`${API_URL}/documents/${testDoc._id}/versions`)
        .catch(error => error.response)
      
      expect(response.status).toBe(400)
      expect(response.data.error).toBe('Version ID is required')
    }, 10000)

    it('should return 404 for non-existent document', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString()
      const response = await axios.delete(`${API_URL}/documents/${nonExistentId}/versions?versionId=${testVersion._id}`)
        .catch(error => error.response)
      
      expect(response.status).toBe(404)
      expect(response.data.error).toBe('Document not found')
    }, 10000)

    it('should handle deleting non-existent version gracefully', async () => {
      const nonExistentVersionId = new mongoose.Types.ObjectId().toString()
      const response = await axios.delete(`${API_URL}/documents/${testDoc._id}/versions?versionId=${nonExistentVersionId}`)
      
      // The API should still return success even if the version doesn't exist
      expect(response.status).toBe(200)
      expect(response.data.success).toBe(true)
    }, 10000)
  })
}) 