import SyncService from '../electron/sync-service'
import { DocumentData, DocContent } from '@typez/globals'
import { documentStorage } from '../electron/storage-adapter'
import { startTestServer, stopTestServer } from './test-utils/server'
import * as fs from 'fs-extra'
import * as path from 'path'

describe('SyncService Integration Tests', () => {
  const TEST_STORAGE_PATH = path.join(process.cwd(), 'test-data')
  
  beforeAll(async () => {
    // Set up test storage path and start test server
    process.env.JSON_STORAGE_PATH = TEST_STORAGE_PATH
    fs.ensureDirSync(path.join(TEST_STORAGE_PATH, 'documents'))
    
    console.log('Starting test server...')
    await startTestServer()
    console.log('Test server started')
  })

  beforeEach(async () => {
    console.log('Cleaning up test data...')
    // Clean up test storage directory
    if (fs.existsSync(TEST_STORAGE_PATH)) {
      fs.rmSync(TEST_STORAGE_PATH, { recursive: true, force: true })
    }
    fs.mkdirSync(TEST_STORAGE_PATH, { recursive: true })
    fs.mkdirSync(path.join(TEST_STORAGE_PATH, 'documents'), { recursive: true })
    fs.mkdirSync(path.join(TEST_STORAGE_PATH, 'folders'), { recursive: true })
    fs.mkdirSync(path.join(TEST_STORAGE_PATH, 'versions'), { recursive: true })

    // Clean up test database
    await documentStorage.delete('documents', {})
    console.log('Test data cleanup complete')
  })

  afterAll(async () => {
    console.log('Stopping test server...')
    await stopTestServer()
    console.log('Test server stopped')
    
    // Clean up test data
    await fs.remove(TEST_STORAGE_PATH)
  })

  describe('Local Document Operations', () => {
    it('should save and retrieve a local document', async () => {
      const testDoc: Partial<DocumentData> = {
        title: 'Test Document',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Hello, World!'
                }
              ]
            }
          ]
        },
        comments: [],
        lastUpdated: Date.now(),
        userId: 'test-user',
        folderIndex: 0
      }

      // Save document
      const savedDoc = await SyncService.saveLocalDocument(testDoc)
      expect(savedDoc).toBeDefined()
      expect(savedDoc._id).toBeDefined()
      expect(savedDoc.title).toBe(testDoc.title)

      // Retrieve document
      const retrievedDoc = await SyncService.getLocalDocument(savedDoc._id)
      expect(retrievedDoc).toBeDefined()
      expect(retrievedDoc?.title).toBe(testDoc.title)
      expect(retrievedDoc?.content).toEqual(testDoc.content)
    })

    it('should retrieve all local documents', async () => {
      const testDocs: Partial<DocumentData>[] = [
        {
          title: 'Doc 1',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: ''
                  }
                ]
              }
            ]
          },
          comments: [],
          lastUpdated: Date.now(),
          userId: 'test-user',
          folderIndex: 0
        },
        {
          title: 'Doc 2',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: ''
                  }
                ]
              }
            ]
          },
          comments: [],
          lastUpdated: Date.now(),
          userId: 'test-user',
          folderIndex: 1
        }
      ]

      // Save documents
      await Promise.all(testDocs.map(doc => SyncService.saveLocalDocument(doc)))

      // Retrieve all documents
      const allDocs = await SyncService.getAllLocalDocuments()
      expect(allDocs).toHaveLength(2)
      expect(allDocs.map(doc => doc.title)).toEqual(expect.arrayContaining(['Doc 1', 'Doc 2']))
    })

    it('should handle non-existent document gracefully', async () => {
      const doc = await SyncService.getLocalDocument('non-existent-id')
      expect(doc).toBeNull()
    })
  })

  describe('Remote Document Operations', () => {
    it('should create and retrieve a remote document', async () => {
      const testDoc: Partial<DocumentData> = {
        title: 'Test Remote Doc',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'hi mongo db'
                }
              ]
            }
          ]
        },
        userId: 'test-user'
      }

      // Create document
      console.log('Creating test document...')
      const savedDoc = await SyncService.uploadDocument(testDoc as DocumentData)
      expect(savedDoc).toBeTruthy()
      expect(savedDoc._id).toBeTruthy()
      expect(savedDoc.title).toBe(testDoc.title)
      console.log('Test document created:', savedDoc._id)

      // Retrieve document
      console.log('Fetching test document...')
      const fetchedDoc = await SyncService.getRemoteDocument(savedDoc._id)
      expect(fetchedDoc).toBeTruthy()
      expect(fetchedDoc?._id).toBe(savedDoc._id)
      expect(fetchedDoc?.title).toBe(testDoc.title)
      console.log('Test document fetched successfully')
    })

    it('should handle non-existent remote documents gracefully', async () => {
      console.log('Testing non-existent document fetch...')
      const nonExistentId = '507f1f77bcf86cd799439011'
      const doc = await SyncService.getRemoteDocument(nonExistentId)
      expect(doc).toBeNull()
      console.log('Non-existent document test passed')
    })

    it('should fetch multiple documents in bulk', async () => {
      // Create test documents
      console.log('Creating test documents for bulk fetch...')
      const testDocs = await Promise.all([
        SyncService.uploadDocument({
          title: 'Bulk Test 1',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: ''
                  }
                ]
              }
            ]
          },
          userId: 'test-user'
        } as DocumentData),
        SyncService.uploadDocument({
          title: 'Bulk Test 2',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: ''
                  }
                ]
              }
            ]
          },
          userId: 'test-user'
        } as DocumentData)
      ])
      console.log('Test documents created')

      const ids = testDocs.map(doc => doc._id)
      console.log('Fetching documents in bulk:', ids)
      
      const fetchedDocs = await SyncService.bulkFetchRemoteDocuments(ids)
      expect(fetchedDocs).toHaveLength(2)
      expect(fetchedDocs.map(doc => doc._id).sort()).toEqual(ids.sort())
      console.log('Bulk fetch test passed')
    })

    it('should list all remote documents', async () => {
      // Create test documents
      console.log('Creating test documents for listing...')
      await Promise.all([
        SyncService.uploadDocument({
          title: 'List Test 1',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: ''
                  }
                ]
              }
            ]
          },
          userId: 'test-user'
        } as DocumentData),
        SyncService.uploadDocument({
          title: 'List Test 2',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: ''
                  }
                ]
              }
            ]
          },
          userId: 'test-user'
        } as DocumentData)
      ])
      console.log('Test documents created')

      console.log('Fetching all remote documents...')
      const allDocs = await SyncService.getRemoteDocuments()
      expect(allDocs.length).toBeGreaterThanOrEqual(2)
      expect(allDocs.some(doc => doc.title === 'List Test 1')).toBeTruthy()
      expect(allDocs.some(doc => doc.title === 'List Test 2')).toBeTruthy()
      console.log('List documents test passed')
    })
  })

  describe('Synchronized Document Operations', () => {
    it('should save document both locally and remotely', async () => {
      const testDoc: Partial<DocumentData> = {
        title: 'Sync Test Document',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'hello wizard'
                }
              ]
            }
          ]
        },
        comments: [],
        lastUpdated: Date.now(),
        userId: 'test-user',
        folderIndex: 0
      }

      // Save document
      const savedDoc = await SyncService.saveDocument(testDoc)
      expect(savedDoc).toBeDefined()
      expect(savedDoc._id).toBeDefined()
      expect(savedDoc.title).toBe(testDoc.title)

      // Verify document exists locally
      const localDoc = await SyncService.getLocalDocument(savedDoc._id)
      expect(localDoc).toBeDefined()
      expect(localDoc?.title).toBe(testDoc.title)
      expect(localDoc?.content).toEqual(testDoc.content)

      // Verify document exists remotely
      const remoteDoc = await SyncService.getRemoteDocument(savedDoc._id)
      expect(remoteDoc).toBeDefined()
      expect(remoteDoc?.title).toBe(testDoc.title)
      expect(remoteDoc?.content).toEqual(testDoc.content)
    })

    it('should properly handle YJS content and maintain sync state', async () => {
      const testDoc: Partial<DocumentData> = {
        title: 'YJS Test Document',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'foobarbaz'
                }
              ]
            }
          ]
        },
        comments: [],
        lastUpdated: Date.now(),
        userId: 'test-user',
        folderIndex: 0
      }

      // Save document
      const savedDoc = await SyncService.saveDocument(testDoc)
      expect(savedDoc).toBeDefined()
      expect(savedDoc._id).toBeDefined()
      expect(savedDoc.title).toBe(testDoc.title)

      // Verify local document has YJS content
      const localDoc = await documentStorage.findById('documents', savedDoc._id)
      expect(localDoc).toBeDefined()
      expect(localDoc?.content).toHaveProperty('type', 'yjs')
      expect(localDoc?.content).toHaveProperty('content')
      expect(Array.isArray((localDoc?.content as any).content)).toBe(true)
      expect(localDoc?.updatedBy).toBe('local')

      // Verify the content is readable when fetched through the service
      const retrievedDoc = await SyncService.getLocalDocument(savedDoc._id)
      expect(retrievedDoc).toBeDefined()
      expect(retrievedDoc?.content).toEqual(testDoc.content)
    })

    it('should sync multiple document changes correctly', async () => {
      const testDoc: Partial<DocumentData> = {
        title: 'Sync Changes Test',
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Initial content'
                }
              ]
            }
          ]
        },
        comments: [],
        lastUpdated: Date.now(),
        userId: 'test-user',
        folderIndex: 0
      }

      // Save initial document
      const savedDoc = await SyncService.saveDocument(testDoc)
      expect(savedDoc).toBeDefined()
      expect(savedDoc._id).toBeDefined()

      // Define changes from multiple users
      const userAChanges: DocContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Initial content - modified by A'
              }
            ]
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'A\'s new paragraph'
              }
            ]
          }
        ]
      }

      const userBChanges: DocContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Initial content (B\'s edit)'
              }
            ]
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'B\'s new paragraph'
              }
            ]
          }
        ]
      }

      // Apply both changes
      const finalDoc = await SyncService.syncDocumentChanges(savedDoc._id, [userAChanges, userBChanges])
      expect(finalDoc).toBeDefined()
      expect(finalDoc.content).toBeDefined()

      // Verify the content structure
      const content = finalDoc.content as DocContent
      expect(content.type).toBe('doc')
      expect(content.content.length).toBeGreaterThan(1)

      // Get all text content
      const allTexts = content.content
        .map((p: { content?: Array<{ text: string }> }) => 
          p.content?.map((n: { text: string }) => n.text).join('') || ''
        )

      // Verify both users' changes are preserved
      const hasUserAContent = allTexts.some((text: string) => 
        text.includes('modified by A') || text.includes('A\'s new paragraph')
      )
      const hasUserBContent = allTexts.some((text: string) => 
        text.includes('B\'s edit') || text.includes('B\'s new paragraph')
      )

      expect(hasUserAContent).toBe(true)
      expect(hasUserBContent).toBe(true)

      // Verify local storage has YJS content
      const localDoc = await documentStorage.findById('documents', savedDoc._id)
      expect(localDoc).toBeDefined()
      expect(localDoc?.content).toHaveProperty('type', 'yjs')
      expect(localDoc?.content).toHaveProperty('content')
      expect(Array.isArray((localDoc?.content as any).content)).toBe(true)
    })
  })
})