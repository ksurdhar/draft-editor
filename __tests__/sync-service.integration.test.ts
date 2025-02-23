import SyncService from '../electron/sync-service'
import { DocumentData } from '@typez/globals'
import { documentStorage } from '../electron/storage-adapter'
import { startTestServer, stopTestServer } from './test-utils/server'
import * as fs from 'fs-extra'
import * as path from 'path'
import apiService from '../electron/api-service'

// Add the extended interface for test documents
interface TestDocumentData extends DocumentData {
  updatedBy?: 'local' | 'remote';
}

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
        content: 'Hello, World!',
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
      expect(retrievedDoc?.content).toBe(testDoc.content)
    })

    it('should retrieve all local documents', async () => {
      const testDocs: Partial<DocumentData>[] = [
        {
          title: 'Doc 1',
          content: 'Content 1',
          comments: [],
          lastUpdated: Date.now(),
          userId: 'test-user',
          folderIndex: 0
        },
        {
          title: 'Doc 2',
          content: 'Content 2',
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

    it('should save and preserve the updatedBy flag', async () => {
      const testDoc: Partial<DocumentData> = {
        title: 'Test Document',
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Hello, World!'
            }]
          }]
        }),
        comments: [],
        lastUpdated: Date.now(),
        userId: 'test-user',
        folderIndex: 0
      }

      // Save document with updatedBy flag
      const savedDoc = await documentStorage.create('documents', {
        ...testDoc,
        updatedBy: 'local'
      } as any)
      expect(savedDoc).toBeDefined()
      expect(savedDoc.updatedBy).toBe('local')

      // Retrieve document and verify flag is preserved
      const retrievedDoc = await documentStorage.findById('documents', savedDoc._id)
      expect(retrievedDoc).toBeDefined()
      expect(retrievedDoc?.updatedBy).toBe('local')

      // Update document with new flag
      await documentStorage.update('documents', savedDoc._id, {
        updatedBy: 'remote',
        content: retrievedDoc?.content // Preserve the existing content
      } as any)

      // Verify flag was updated
      const updatedDoc = await documentStorage.findById('documents', savedDoc._id)
      expect(updatedDoc).toBeDefined()
      expect(updatedDoc?.updatedBy).toBe('remote')
    })
  })

  describe('Remote Document Operations', () => {
    it('should create and retrieve a remote document', async () => {
      const testDoc: Partial<DocumentData> = {
        title: 'Test Remote Doc',
        content: 'Test content',
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
          content: 'Content 1',
          userId: 'test-user'
        } as DocumentData),
        SyncService.uploadDocument({
          title: 'Bulk Test 2',
          content: 'Content 2',
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
          content: 'Content 1',
          userId: 'test-user'
        } as DocumentData),
        SyncService.uploadDocument({
          title: 'List Test 2',
          content: 'Content 2',
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
        content: 'Hello, synchronized world!',
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
      expect(localDoc?.content).toBe(testDoc.content)

      // Verify document exists remotely
      const remoteDoc = await SyncService.getRemoteDocument(savedDoc._id)
      expect(remoteDoc).toBeDefined()
      expect(remoteDoc?.title).toBe(testDoc.title)
      expect(remoteDoc?.content).toBe(testDoc.content)
    })

    it('should properly handle YJS content and maintain sync state', async () => {
      const testDoc: Partial<DocumentData> = {
        title: 'YJS Test Document',
        content: 'Initial content',
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
      const content = JSON.parse(localDoc?.content as string)
      expect(content).toHaveProperty('type', 'yjs')
      expect(content).toHaveProperty('state')
      expect(localDoc?.updatedBy).toBe('local')

      // Verify the content is readable when fetched through the service
      const retrievedDoc = await SyncService.getLocalDocument(savedDoc._id)
      expect(retrievedDoc).toBeDefined()
      expect(retrievedDoc?.content).toBe(testDoc.content)
    })

    it('should sync remote documents to local storage on startup', async () => {
      // Clear both local and remote documents
      await documentStorage.delete('documents', {})

      // Get all remote documents and delete them
      const remoteDocs = await SyncService.getRemoteDocuments()
      await Promise.all(remoteDocs.map(doc => apiService.deleteDocument(doc._id)))

      // Verify local storage is empty
      const localDocsBefore = await SyncService.getAllLocalDocuments()
      expect(localDocsBefore).toHaveLength(0)

      // Create some documents directly on the remote server
      const remoteDoc1 = await SyncService.uploadDocument({
        title: 'Remote Doc 1',
        content: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Remote content 1'
            }]
          }]
        },
        userId: 'test-user'
      } as DocumentData)

      const remoteDoc2 = await SyncService.uploadDocument({
        title: 'Remote Doc 2',
        content: {
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Remote content 2'
            }]
          }]
        },
        userId: 'test-user'
      } as DocumentData)

      // Run startup sync
      await SyncService.syncRemoteToLocal()

      // Verify documents were synced to local storage
      const localDocsAfter = await SyncService.getAllLocalDocuments()
      expect(localDocsAfter).toHaveLength(2)

      // Verify content matches
      const localDoc1 = await SyncService.getLocalDocument(remoteDoc1._id)
      const localDoc2 = await SyncService.getLocalDocument(remoteDoc2._id)

      expect(localDoc1).toBeDefined()
      expect(localDoc1?.title).toBe('Remote Doc 1')
      expect(localDoc1?.content).toBe(JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Remote content 1'
          }]
        }]
      }))

      expect(localDoc2).toBeDefined()
      expect(localDoc2?.title).toBe('Remote Doc 2')
      expect(localDoc2?.content).toBe(JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Remote content 2'
          }]
        }]
      }))
    })

    it('should update local documents when remote changes are detected', async () => {
      // Create initial documents
      const doc1 = await SyncService.uploadDocument({
        title: 'Update Test Doc 1',
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Initial content 1'
            }]
          }]
        }),
        userId: 'test-user'
      } as DocumentData)

      const doc2 = await SyncService.uploadDocument({
        title: 'Update Test Doc 2',
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Initial content 2'
            }]
          }]
        }),
        userId: 'test-user'
      } as DocumentData)

      // Initial sync to create local copies
      await SyncService.syncRemoteToLocal()

      // Verify initial state
      const initialLocal1 = await SyncService.getLocalDocument(doc1._id)
      const initialLocal2 = await SyncService.getLocalDocument(doc2._id)
      expect(initialLocal1).toBeDefined()
      expect(initialLocal2).toBeDefined()

      // Simulate remote updates
      const updatedDoc1 = await SyncService.uploadDocument({
        ...doc1,
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Updated content 1'
            }]
          }]
        }),
        lastUpdated: Date.now() + 1000 // Ensure newer timestamp
      } as DocumentData)

      // Update local doc2's updatedBy field to 'remote' to test the second condition
      await documentStorage.update('documents', doc2._id, {
        updatedBy: 'remote'
      } as any)

      const updatedDoc2 = await SyncService.uploadDocument({
        ...doc2,
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Updated content 2'
            }]
          }]
        })
      } as DocumentData)

      // Run sync again
      await SyncService.syncRemoteToLocal()

      // Verify updates
      const finalLocal1 = await SyncService.getLocalDocument(doc1._id)
      const finalLocal2 = await SyncService.getLocalDocument(doc2._id)

      // Doc1 should be updated due to newer timestamp
      const content1 = typeof finalLocal1?.content === 'string' ? 
        JSON.parse(finalLocal1.content) : 
        finalLocal1?.content
      expect(content1).toEqual({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Updated content 1'
          }]
        }]
      })

      // Doc2 should be updated due to updatedBy: 'remote'
      const content2 = typeof finalLocal2?.content === 'string' ? 
        JSON.parse(finalLocal2.content) : 
        finalLocal2?.content
      expect(content2).toEqual({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Updated content 2'
          }]
        }]
      })
    })

    it('should preserve concurrent edits when syncing', async () => {
      console.log('Starting concurrent edits test...')
      
      // Create initial document
      const doc = await SyncService.uploadDocument({
        title: 'Merge Test Doc',
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Initial content'
            }]
          }]
        }),
        userId: 'test-user'
      } as DocumentData)
      console.log('Initial document created:', doc._id)
      console.log('Initial content:', doc.content)

      // Initial sync to create local copy
      console.log('Performing initial sync...')
      await SyncService.syncRemoteToLocal()
      const afterInitialSync = await SyncService.getLocalDocument(doc._id) as TestDocumentData
      console.log('Document after initial sync:', {
        id: afterInitialSync?._id,
        content: afterInitialSync?.content,
        updatedBy: afterInitialSync?.updatedBy
      })

      // Make local change
      const localUpdateTime = Date.now() + 1000
      console.log('Making local change at time:', localUpdateTime)
      await documentStorage.update('documents', doc._id, {
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Initial content'
            }]
          }, {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Local addition'
            }]
          }]
        }),
        updatedBy: 'local',
        lastUpdated: localUpdateTime
      } as any)
      
      const afterLocalChange = await SyncService.getLocalDocument(doc._id) as TestDocumentData
      console.log('Document after local change:', {
        id: afterLocalChange?._id,
        content: afterLocalChange?.content,
        updatedBy: afterLocalChange?.updatedBy,
        lastUpdated: afterLocalChange?.lastUpdated
      })

      // Make remote change with different content
      const remoteUpdateTime = Date.now() + 2000
      console.log('Making remote change at time:', remoteUpdateTime)
      const updatedRemoteDoc = await SyncService.uploadDocument({
        ...doc,
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Initial content'
            }]
          }, {
            type: 'paragraph',
            content: [{
              type: 'text',
              text: 'Remote addition'
            }]
          }]
        }),
        lastUpdated: remoteUpdateTime
      } as DocumentData)
      console.log('Remote document after update:', {
        id: updatedRemoteDoc._id,
        content: updatedRemoteDoc.content,
        lastUpdated: updatedRemoteDoc.lastUpdated
      })

      // Run sync
      console.log('Running final sync...')
      await SyncService.syncRemoteToLocal()

      // Verify final state
      const finalDoc = await SyncService.getLocalDocument(doc._id) as TestDocumentData
      console.log('Final document state:', {
        id: finalDoc?._id,
        content: finalDoc?.content,
        updatedBy: finalDoc?.updatedBy,
        lastUpdated: finalDoc?.lastUpdated
      })

      const content = typeof finalDoc?.content === 'string' ? 
        JSON.parse(finalDoc.content) : 
        finalDoc?.content

      expect(content).toEqual({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Initial content'
          }]
        }, {
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Local addition'
          }]
        }, {
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Remote addition'
          }]
        }]
      })
    })
  })
})