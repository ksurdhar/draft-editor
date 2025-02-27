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

      console.log('Final doc content:', JSON.stringify(finalDoc.content, null, 2))

      // Verify the content structure
      const content = finalDoc.content as DocContent
      expect(content.type).toBe('doc')
      expect(content.content.length).toBeGreaterThan(1)

      // Get all text content
      const allTexts = content.content
        .map((p: { content?: Array<{ text: string }> }) => 
          p.content?.map((n: { text: string }) => n.text).join('') || ''
        )
      console.log('All texts:', allTexts)

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

  describe('Document Synchronization Scenarios', () => {
    // Helper function to create a test document
    const createTestDocument = async (title: string, initialContent: string): Promise<DocumentData> => {
      const testDoc: Partial<DocumentData> = {
        title,
        content: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: initialContent
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
      
      return await SyncService.saveDocument(testDoc)
    }
    
    // Helper to create document content
    const createDocContent = (paragraphs: string[]): DocContent => ({
      type: 'doc',
      content: paragraphs.map(text => ({
        type: 'paragraph',
        content: [{ type: 'text', text }]
      }))
    })
    
    // Helper to extract text from document content
    const extractTexts = (content: DocContent): string[] => {
      return content.content.map(p => 
        p.content?.[0]?.text || ''
      )
    }
    
    it('should handle basic edits to the same paragraph', async () => {
      // Create initial document
      const initialDoc = await createTestDocument('Basic Edits Test', 'This is the original text')
      
      // Define user changes
      const userAChanges = createDocContent(['This is the original text with A\'s additions'])
      const userBChanges = createDocContent(['This is the original text with B\'s modifications'])
      
      // Apply changes
      const result = await SyncService.syncDocumentChanges(initialDoc._id, [userAChanges, userBChanges])
      
      // Verify result
      const texts = extractTexts(result.content as DocContent)
      console.log('Basic edits result:', texts)
      
      // We expect a merged paragraph containing elements from both edits
      expect(texts.length).toBe(1)
      expect(texts[0]).toContain('A\'s additions')
      expect(texts[0]).toContain('B\'s modifications')
    })
    
    it('should handle adding paragraphs in different positions', async () => {
      // Create initial document with multiple paragraphs
      const initialContent = createDocContent([
        'First paragraph',
        'Second paragraph',
        'Third paragraph'
      ])
      
      const testDoc: Partial<DocumentData> = {
        title: 'Adding Paragraphs Test',
        content: initialContent,
        comments: [],
        lastUpdated: Date.now(),
        userId: 'test-user',
        folderIndex: 0
      }
      
      const initialDoc = await SyncService.saveDocument(testDoc)
      
      // User A adds a paragraph between first and second
      const userAChanges = createDocContent([
        'First paragraph',
        'A\'s new paragraph',
        'Second paragraph',
        'Third paragraph'
      ])
      
      // User B adds a paragraph between second and third
      const userBChanges = createDocContent([
        'First paragraph',
        'Second paragraph',
        'B\'s new paragraph',
        'Third paragraph'
      ])
      
      // Apply changes
      const result = await SyncService.syncDocumentChanges(initialDoc._id, [userAChanges, userBChanges])
      
      // Verify result
      const texts = extractTexts(result.content as DocContent)
      console.log('Adding paragraphs result:', texts)
      
      // We expect both new paragraphs to be present
      expect(texts.length).toBe(5)
      expect(texts[1]).toBe('A\'s new paragraph')
      
      // B's paragraph should be after Second paragraph since that was its position in userBChanges
      expect(texts[3]).toBe('B\'s new paragraph')
      
      // Verify overall structure
      expect(texts).toEqual([
        'First paragraph',
        'A\'s new paragraph',
        'Second paragraph',
        'B\'s new paragraph',
        'Third paragraph'
      ])
    })
    
    it('should handle local version behind cloud version', async () => {
      // Create initial document
      const initialDoc = await createTestDocument('Local Behind Test', 'Initial shared content')
      
      // Cloud version has more changes
      const cloudChanges = createDocContent([
        'Initial shared content with cloud updates',
        'Additional cloud paragraph'
      ])
      
      // Local version has minor changes
      const localChanges = createDocContent(['Initial shared content with minor local edit'])
      
      // Apply changes (cloud first, then local)
      const result = await SyncService.syncDocumentChanges(initialDoc._id, [cloudChanges, localChanges])
      
      // Verify result
      const texts = extractTexts(result.content as DocContent)
      console.log('Local behind cloud result:', texts)
      
      // We expect merged content of the first paragraph and the additional cloud paragraph
      expect(texts.length).toBe(2)
      expect(texts[0]).toContain('cloud updates')
      expect(texts[0]).toContain('local edit')
      expect(texts[1]).toBe('Additional cloud paragraph')
    })
    
    it('should handle cloud version behind local version', async () => {
      // Create initial document
      const initialDoc = await createTestDocument('Cloud Behind Test', 'Initial shared content')
      
      // Local version has more changes
      const localChanges = createDocContent([
        'Initial shared content with extensive local updates',
        'New local paragraph with important info'
      ])
      
      // Cloud version has minor changes
      const cloudChanges = createDocContent(['Initial shared content with small cloud edit'])
      
      // Apply changes (local first, then cloud)
      const result = await SyncService.syncDocumentChanges(initialDoc._id, [localChanges, cloudChanges])
      
      // Verify result
      const texts = extractTexts(result.content as DocContent)
      console.log('Cloud behind local result:', texts)
      
      // We expect merged content of the first paragraph and the additional local paragraph
      expect(texts.length).toBe(2)
      expect(texts[0]).toContain('extensive local updates')
      expect(texts[0]).toContain('small cloud edit')
      expect(texts[1]).toBe('New local paragraph with important info')
    })
    
    it('should handle significant divergence between versions', async () => {
      // Create initial document
      const initialDoc = await createTestDocument('Divergent Versions Test', 'Base shared content')
      
      // Local version has completely different content
      const localChanges = createDocContent([
        'Completely rewritten local introduction',
        'New local body paragraph',
        'Local conclusion'
      ])
      
      // Cloud version also has completely different content
      const cloudChanges = createDocContent([
        'Cloud version introduction',
        'Cloud body paragraph 1',
        'Cloud body paragraph 2',
        'Cloud conclusion'
      ])
      
      // Apply changes
      const result = await SyncService.syncDocumentChanges(initialDoc._id, [localChanges, cloudChanges])
      
      // Verify result
      const texts = extractTexts(result.content as DocContent)
      console.log('Divergent versions result:', texts)
      
      // In a significant divergence, we expect the system to preserve both versions
      // with some attempt at merging the first paragraph
      expect(texts.length).toBeGreaterThan(3)
      expect(texts.some(t => t.includes('local'))).toBeTruthy()
      expect(texts.some(t => t.includes('Cloud'))).toBeTruthy()
    })
    
    it('should handle one version deleting content the other modified', async () => {
      // Create initial document with multiple paragraphs
      const initialContent = createDocContent([
        'Introduction paragraph',
        'Second paragraph to be deleted by one user',
        'Third paragraph to stay unchanged'
      ])
      
      const testDoc: Partial<DocumentData> = {
        title: 'Deletion vs Modification Test',
        content: initialContent,
        comments: [],
        lastUpdated: Date.now(),
        userId: 'test-user',
        folderIndex: 0
      }
      
      const initialDoc = await SyncService.saveDocument(testDoc)
      
      // User A deletes the second paragraph
      const userAChanges = createDocContent([
        'Introduction paragraph', 
        'Third paragraph to stay unchanged'
      ])
      
      // User B modifies the second paragraph
      const userBChanges = createDocContent([
        'Introduction paragraph',
        'Second paragraph MODIFIED by user B',
        'Third paragraph to stay unchanged'
      ])
      
      // Apply changes
      const result = await SyncService.syncDocumentChanges(initialDoc._id, [userAChanges, userBChanges])
      
      // Verify result
      const texts = extractTexts(result.content as DocContent)
      console.log('Deletion vs modification result:', texts)
      
      // In conflict between deletion and modification, our algorithm should
      // prefer keeping the modified content
      expect(texts.length).toBe(3)
      expect(texts[1]).toContain('MODIFIED')
    })
    
    it('should handle concurrent complex edits to the same paragraph', async () => {
      // Create initial document
      const initialDoc = await createTestDocument('Complex Edits Test', 
        'The quick brown fox jumps over the lazy dog')
      
      // User A modifies the beginning and end
      const userAChanges = createDocContent([
        'The fast brown fox leaps over the lazy dog and runs away'
      ])
      
      // User B modifies the middle
      const userBChanges = createDocContent([
        'The quick brown fox quickly jumps over the sleepy dog'
      ])
      
      // Apply changes
      const result = await SyncService.syncDocumentChanges(initialDoc._id, [userAChanges, userBChanges])
      
      // Verify result
      const texts = extractTexts(result.content as DocContent)
      console.log('Complex edits result:', texts)
      
      // We expect a sophisticated merge that captures all changes
      expect(texts.length).toBe(1)
      expect(texts[0]).toContain('fast')  // from A
      expect(texts[0]).toContain('leaps') // from A
      expect(texts[0]).toContain('runs away') // from A
      expect(texts[0]).toContain('quickly') // from B
      expect(texts[0]).toContain('sleepy') // from B
    })

    it('should respect paragraph deletion when not modified in other version', async () => {
      // Create initial document with multiple paragraphs
      const initialContent = createDocContent([
        'Introduction paragraph that stays',
        'Middle paragraph to be deleted',
        'Another middle paragraph to keep',
        'Final paragraph that stays'
      ])
      
      const testDoc: Partial<DocumentData> = {
        title: 'Deletion Test',
        content: initialContent,
        comments: [],
        lastUpdated: Date.now(),
        userId: 'test-user',
        folderIndex: 0
      }
      
      const initialDoc = await SyncService.saveDocument(testDoc)
      
      // Web app version - user deletes the second paragraph
      const webAppChanges = createDocContent([
        'Introduction paragraph that stays',
        'Another middle paragraph to keep',
        'Final paragraph that stays'
      ])
      
      // Desktop app version - user doesn't modify the deleted paragraph
      // but makes changes to other paragraphs
      const desktopAppChanges = createDocContent([
        'Introduction paragraph that stays (with desktop edit)',
        'Middle paragraph to be deleted',
        'Another middle paragraph to keep (desktop edit)',
        'Final paragraph that stays (edited on desktop)'
      ])
      
      // Apply changes
      const result = await SyncService.syncDocumentChanges(initialDoc._id, [webAppChanges, desktopAppChanges])
      
      // Verify result
      const texts = extractTexts(result.content as DocContent)
      console.log('Deletion respect result:', texts)
      
      // We expect the deleted paragraph to be gone while other edits are preserved
      expect(texts.length).toBe(3) // Should be 3 paragraphs, not 4
      expect(texts[0]).toContain('Introduction')
      expect(texts[0]).toContain('desktop edit') // Desktop edits preserved
      expect(texts.some(t => t === 'Middle paragraph to be deleted')).toBe(false) // Deleted paragraph should be gone
      expect(texts[1]).toContain('Another middle paragraph')
      expect(texts[1]).toContain('desktop edit') // Desktop edits preserved
      expect(texts[2]).toContain('Final paragraph')
      expect(texts[2]).toContain('edited on desktop') // Desktop edits preserved
    })
  })
})