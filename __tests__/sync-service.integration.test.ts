import SyncService from '../electron/sync-service'
import { DocumentData } from '@typez/globals'
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
})