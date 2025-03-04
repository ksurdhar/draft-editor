import fs from 'fs-extra'
import path from 'path'
import apiService from '../electron/api-service'
import { DocumentData, FolderData } from '@typez/globals'

// Mock the env-electron.json to use local DB
jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs')
  return {
    ...originalFs,
    readFileSync: (filePath: string, encoding: string) => {
      if (filePath.includes('env-electron.json')) {
        return JSON.stringify({
          LOCAL_DB: true,
          APP_STORAGE: false
        })
      }
      return originalFs.readFileSync(filePath, encoding)
    }
  }
})

// Mock auth service to bypass authentication
jest.mock('../electron/auth-service', () => ({
  getAccessToken: jest.fn().mockReturnValue('mock-token'),
  isTokenExpired: jest.fn().mockReturnValue(false),
  refreshTokens: jest.fn().mockResolvedValue(undefined)
}))

describe('Electron API Service - Local Storage Integration Tests', () => {
  const testDataDir = path.resolve(process.cwd(), 'data')
  const documentsDir = path.join(testDataDir, 'documents')
  const foldersDir = path.join(testDataDir, 'folders')
  const versionsDir = path.join(testDataDir, 'versions')

  // Clean up test data before and after tests
  beforeAll(async () => {
    // Ensure test directories exist
    await fs.ensureDir(documentsDir)
    await fs.ensureDir(foldersDir)
    await fs.ensureDir(versionsDir)
    
    // Clean up any existing test data
    const docFiles = await fs.readdir(documentsDir)
    for (const file of docFiles) {
      if (file.endsWith('.json')) {
        await fs.remove(path.join(documentsDir, file))
      }
    }
    
    const folderFiles = await fs.readdir(foldersDir)
    for (const file of folderFiles) {
      if (file.endsWith('.json')) {
        await fs.remove(path.join(foldersDir, file))
      }
    }
    
    const versionFiles = await fs.readdir(versionsDir)
    for (const file of versionFiles) {
      if (file.endsWith('.json')) {
        await fs.remove(path.join(versionsDir, file))
      }
    }
  }, 10000)

  afterAll(async () => {
    // Clean up test data
    await fs.emptyDir(documentsDir)
    await fs.emptyDir(foldersDir)
    await fs.emptyDir(versionsDir)
  }, 10000)

  describe('Document Operations', () => {
    it('should create a new document locally', async () => {
      // Create a new document
      const newDocData: Partial<DocumentData> = {
        title: 'Test Document',
        userId: 'test-user-id',
        folderIndex: 0
      }
      
      const result = await apiService.post('documents', newDocData)
      
      // Verify the document was created
      expect(result).toBeDefined()
      expect(result._id).toBeDefined()
      expect(result.title).toBe('Test Document')
      expect(result.userId).toBe('test-user-id')
      expect(result.folderIndex).toBe(0)
      
      // Verify the document file exists
      const docPath = path.join(documentsDir, `${result._id}.json`)
      expect(fs.existsSync(docPath)).toBe(true)
      
      // Verify file contents
      const fileContent = await fs.readFile(docPath, 'utf-8')
      const savedDoc = JSON.parse(fileContent)
      expect(savedDoc._id).toBe(result._id)
      expect(savedDoc.title).toBe('Test Document')
      expect(savedDoc.content).toBeDefined()
      expect(typeof savedDoc.content).toBe('object')
      expect(savedDoc.content.type).toBe('doc')
      
      return result
    }, 10000)
    
    it('should retrieve all documents', async () => {
      // Create a second document to ensure we have multiple
      const secondDocData: Partial<DocumentData> = {
        title: 'Second Test Document',
        userId: 'test-user-id',
        folderIndex: 1
      }
      
      await apiService.post('documents', secondDocData)
      
      // Get all documents
      const documents = await apiService.getDocuments()
      
      // Verify we got both documents
      expect(Array.isArray(documents)).toBe(true)
      expect(documents.length).toBeGreaterThanOrEqual(2)
      
      // Verify document properties
      const testDoc = documents.find((doc: DocumentData) => doc.title === 'Test Document')
      const secondDoc = documents.find((doc: DocumentData) => doc.title === 'Second Test Document')
      
      expect(testDoc).toBeDefined()
      expect(secondDoc).toBeDefined()
      
      expect(testDoc?.userId).toBe('test-user-id')
      expect(secondDoc?.userId).toBe('test-user-id')
      
      // Verify content is in TipTap format, not YJS
      expect(typeof testDoc?.content).toBe('object')
      expect(typeof secondDoc?.content).toBe('object')
      expect(testDoc?.content.type).toBe('doc')
      expect(secondDoc?.content.type).toBe('doc')
    }, 10000)
    
    it('should retrieve a document by ID', async () => {
      // Get all documents to find an ID
      const documents = await apiService.getDocuments()
      const testDoc = documents.find((doc: DocumentData) => doc.title === 'Test Document')
      
      expect(testDoc).toBeDefined()
      expect(testDoc?._id).toBeDefined()
      
      // Get the document by ID
      const document = await apiService.get(`documents/${testDoc?._id}`)
      
      // Verify document properties
      expect(document).toBeDefined()
      expect(document._id).toBe(testDoc?._id)
      expect(document.title).toBe('Test Document')
      expect(document.userId).toBe('test-user-id')
      
      // Verify content is in TipTap format
      expect(typeof document.content).toBe('object')
      expect(document.content.type).toBe('doc')
    }, 10000)
    
    it('should update a document', async () => {
      // Get all documents to find an ID
      const documents = await apiService.getDocuments()
      const testDoc = documents.find((doc: DocumentData) => doc.title === 'Test Document')
      
      expect(testDoc).toBeDefined()
      expect(testDoc?._id).toBeDefined()
      
      // Update the document with TipTap content
      const updateData: Partial<DocumentData> = {
        title: 'Updated Test Document',
        content: JSON.stringify({
          type: 'doc', 
          content: [{ 
            type: 'paragraph', 
            content: [{ 
              type: 'text', 
              text: 'Updated content' 
            }] 
          }]
        })
      }
      
      const updatedDoc = await apiService.updateDocument(testDoc?._id as string, updateData)
      
      // Verify document was updated
      expect(updatedDoc).toBeDefined()
      expect(updatedDoc._id).toBe(testDoc?._id)
      expect(updatedDoc.title).toBe('Updated Test Document')
      
      // Get the content, whether it's a string or object
      const content = typeof updatedDoc.content === 'string' 
        ? JSON.parse(updatedDoc.content)
        : updatedDoc.content
      
      // Verify content was updated and is in TipTap format
      expect(content.type).toBe('doc')
      expect(content.content[0].content[0].text).toBe('Updated content')
      
      // Verify file was updated
      const docPath = path.join(documentsDir, `${testDoc?._id}.json`)
      const fileContent = await fs.readFile(docPath, 'utf-8')
      const savedDoc = JSON.parse(fileContent)
      
      expect(savedDoc.title).toBe('Updated Test Document')
      expect(savedDoc.content.type).toBe('doc')
    }, 10000)
    
    it('should delete a document', async () => {
      // Get all documents to find an ID
      const documents = await apiService.getDocuments()
      const secondDoc = documents.find((doc: DocumentData) => doc.title === 'Second Test Document')
      
      expect(secondDoc).toBeDefined()
      expect(secondDoc?._id).toBeDefined()
      
      // Delete the document
      const result = await apiService.deleteDocument(secondDoc?._id as string)
      
      // Verify deletion was successful
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      
      // Verify file was deleted
      const docPath = path.join(documentsDir, `${secondDoc?._id}.json`)
      expect(fs.existsSync(docPath)).toBe(false)
      
      // Verify document is no longer in the list
      const updatedDocuments = await apiService.getDocuments()
      const deletedDoc = updatedDocuments.find((doc: DocumentData) => doc._id === secondDoc?._id)
      expect(deletedDoc).toBeUndefined()
    }, 10000)
  })

  describe('Folder Operations', () => {
    let testFolderId: string

    beforeEach(async () => {
      // Create a test folder to work with
      const newFolderData = {
        title: 'Test Folder',
        userId: 'test-user-id',
        parentId: 'root',
        folderIndex: 0
      }
      
      const result = await apiService.post('folders', newFolderData)
      testFolderId = result._id
    })

    it('should create a new folder locally', async () => {
      // Create a new folder
      const newFolderData = {
        title: 'Another Test Folder',
        userId: 'test-user-id',
        parentId: 'root',
        folderIndex: 1
      }
      
      const result = await apiService.post('folders', newFolderData)
      
      // Verify the folder was created
      expect(result).toBeDefined()
      expect(result._id).toBeDefined()
      expect(result.title).toBe('Another Test Folder')
      expect(result.userId).toBe('test-user-id')
      expect(result.parentId).toBe('root')
      expect(result.folderIndex).toBe(1)
      
      // Verify the folder file exists
      const folderPath = path.join(foldersDir, `${result._id}.json`)
      expect(fs.existsSync(folderPath)).toBe(true)
      
      // Verify file contents
      const fileContent = await fs.readFile(folderPath, 'utf-8')
      const savedFolder = JSON.parse(fileContent)
      expect(savedFolder._id).toBe(result._id)
      expect(savedFolder.title).toBe('Another Test Folder')
    })
    
    it('should retrieve all folders', async () => {
      // Get all folders
      const folders = await apiService.getFolders()
      
      // Verify we got the folders
      expect(Array.isArray(folders)).toBe(true)
      expect(folders.length).toBeGreaterThanOrEqual(1)
      
      // Verify folder properties
      const testFolder = folders.find((folder: FolderData) => folder._id === testFolderId)
      expect(testFolder).toBeDefined()
      expect(testFolder?.userId).toBe('test-user-id')
      expect(testFolder?.parentId).toBe('root')
    })

    it('should retrieve a folder by ID', async () => {
      // Get the folder by ID
      const folder = await apiService.get(`folders/${testFolderId}`)
      
      // Verify folder properties
      expect(folder).toBeDefined()
      expect(folder._id).toBe(testFolderId)
      expect(folder.title).toBe('Test Folder')
      expect(folder.userId).toBe('test-user-id')
      expect(folder.parentId).toBe('root')
    })

    it('should update a folder', async () => {
      // Update the folder
      const updateData = {
        title: 'Updated Test Folder',
        folderIndex: 2
      }
      
      const updatedFolder = await apiService.patch(`folders/${testFolderId}`, updateData)
      
      // Verify folder was updated
      expect(updatedFolder).toBeDefined()
      expect(updatedFolder._id).toBe(testFolderId)
      expect(updatedFolder.title).toBe('Updated Test Folder')
      expect(updatedFolder.folderIndex).toBe(2)
      
      // Verify file was updated
      const folderPath = path.join(foldersDir, `${testFolderId}.json`)
      const fileContent = await fs.readFile(folderPath, 'utf-8')
      const savedFolder = JSON.parse(fileContent)
      expect(savedFolder.title).toBe('Updated Test Folder')
      expect(savedFolder.folderIndex).toBe(2)
    })

    it('should create nested folders', async () => {
      // Create a child folder
      const childFolderData = {
        title: 'Child Folder',
        userId: 'test-user-id',
        parentId: testFolderId,
        folderIndex: 0
      }
      
      const childFolder = await apiService.post('folders', childFolderData)
      
      // Verify child folder was created
      expect(childFolder).toBeDefined()
      expect(childFolder._id).toBeDefined()
      expect(childFolder.title).toBe('Child Folder')
      expect(childFolder.parentId).toBe(testFolderId)
      
      // Get all folders and verify parent-child relationship
      const folders = await apiService.getFolders()
      const parent = folders.find((f: FolderData) => f._id === testFolderId)
      const child = folders.find((f: FolderData) => f._id === childFolder._id)
      
      expect(parent).toBeDefined()
      expect(child).toBeDefined()
      expect(child?.parentId).toBe(parent?._id)
    })

    it('should delete a folder', async () => {
      // Create a folder to delete
      const folderToDelete = await apiService.post('folders', {
        title: 'Folder to Delete',
        userId: 'test-user-id',
        parentId: 'root',
        folderIndex: 3
      })
      
      expect(folderToDelete._id).toBeDefined()
      
      // Delete the folder
      const result = await apiService.destroy(`folders/${folderToDelete._id}`)
      expect(result.success).toBe(true)
      
      // Verify file was deleted
      const folderPath = path.join(foldersDir, `${folderToDelete._id}.json`)
      expect(fs.existsSync(folderPath)).toBe(false)
      
      // Verify folder is no longer in the list
      const folders = await apiService.getFolders()
      const deletedFolder = folders.find((f: FolderData) => f._id === folderToDelete._id)
      expect(deletedFolder).toBeUndefined()
    })

    it('should delete a folder and its nested folders', async () => {
      // Create a child folder
      const childFolder = await apiService.post('folders', {
        title: 'Nested Folder',
        userId: 'test-user-id',
        parentId: testFolderId,
        folderIndex: 0
      })
      
      // Delete the parent folder
      const result = await apiService.destroy(`folders/${testFolderId}`)
      expect(result.success).toBe(true)
      
      // Verify both folders' files were deleted
      const parentPath = path.join(foldersDir, `${testFolderId}.json`)
      const childPath = path.join(foldersDir, `${childFolder._id}.json`)
      expect(fs.existsSync(parentPath)).toBe(false)
      expect(fs.existsSync(childPath)).toBe(false)
      
      // Verify neither folder is in the list
      const folders = await apiService.getFolders()
      const deletedParent = folders.find((f: FolderData) => f._id === testFolderId)
      const deletedChild = folders.find((f: FolderData) => f._id === childFolder._id)
      expect(deletedParent).toBeUndefined()
      expect(deletedChild).toBeUndefined()
    })
  })

  describe('Document in Folder', () => {
    it('should create a document in a folder', async () => {
      // Get the folder ID
      const folders = await apiService.getFolders()
      const testFolder = folders.find((folder: FolderData) => folder.title === 'Test Folder')
      expect(testFolder).toBeDefined()
      expect(testFolder?._id).toBeDefined()
      
      // Create a document in the folder
      const newDocData: Partial<DocumentData> = {
        title: 'Document in Folder',
        userId: 'test-user-id',
        parentId: testFolder?._id,
        folderIndex: 0
      }
      
      const result = await apiService.post('documents', newDocData)
      
      // Verify the document was created
      expect(result).toBeDefined()
      expect(result._id).toBeDefined()
      expect(result.title).toBe('Document in Folder')
      expect(result.userId).toBe('test-user-id')
      expect(result.parentId).toBe(testFolder?._id)
      
      // Get all documents and verify the document is in the folder
      const documents = await apiService.getDocuments()
      const docInFolder = documents.find((doc: DocumentData) => doc.title === 'Document in Folder')
      expect(docInFolder).toBeDefined()
      expect(docInFolder?.parentId).toBe(testFolder?._id)
    }, 10000)
  })

  describe('Version Operations', () => {
    let testDocId: string

    beforeEach(async () => {
      // Create a test document to work with
      const newDocData: Partial<DocumentData> = {
        title: 'Version Test Document',
        userId: 'test-user-id',
        content: JSON.stringify({
          type: 'doc',
          content: [{ 
            type: 'paragraph', 
            content: [{ type: 'text', text: 'Initial content' }] 
          }]
        })
      }
      
      const doc = await apiService.post('documents', newDocData)
      testDocId = doc._id
    })

    it('should create a version of a document', async () => {
      const versionData = {
        documentId: testDocId,
        content: JSON.stringify({
          type: 'doc',
          content: [{ 
            type: 'paragraph', 
            content: [{ type: 'text', text: 'Version 1 content' }] 
          }]
        }),
        title: 'Version 1',
        userId: 'test-user-id'
      }

      const result = await apiService.post(`documents/${testDocId}/versions`, versionData)

      // Verify version was created
      expect(result).toBeDefined()
      expect(result._id).toBeDefined()
      expect(result.documentId).toBe(testDocId)
      expect(result.title).toBe('Version 1')

      // Verify version file exists
      const versionPath = path.join(versionsDir, `${result._id}.json`)
      expect(fs.existsSync(versionPath)).toBe(true)

      // Verify file contents
      const fileContent = await fs.readFile(versionPath, 'utf-8')
      const savedVersion = JSON.parse(fileContent)
      expect(savedVersion.documentId).toBe(testDocId)
      expect(savedVersion.title).toBe('Version 1')
      
      // Parse content and verify
      const content = typeof savedVersion.content === 'string' 
        ? JSON.parse(savedVersion.content)
        : savedVersion.content
      expect(content.type).toBe('doc')
      expect(content.content[0].content[0].text).toBe('Version 1 content')
    })

    it('should retrieve versions of a document', async () => {
      // Create two versions
      const version1Data = {
        documentId: testDocId,
        content: JSON.stringify({
          type: 'doc',
          content: [{ 
            type: 'paragraph', 
            content: [{ type: 'text', text: 'Version 1 content' }] 
          }]
        }),
        title: 'Version 1',
        userId: 'test-user-id'
      }

      const version2Data = {
        documentId: testDocId,
        content: JSON.stringify({
          type: 'doc',
          content: [{ 
            type: 'paragraph', 
            content: [{ type: 'text', text: 'Version 2 content' }] 
          }]
        }),
        title: 'Version 2',
        userId: 'test-user-id'
      }

      await apiService.post(`documents/${testDocId}/versions`, version1Data)
      await apiService.post(`documents/${testDocId}/versions`, version2Data)

      // Get all versions
      const versions = await apiService.get(`documents/${testDocId}/versions`)

      // Verify we got both versions
      expect(Array.isArray(versions)).toBe(true)
      expect(versions.length).toBe(2)

      // Verify version properties
      const [version1, version2] = versions
      expect(version1.title).toBe('Version 1')
      expect(version2.title).toBe('Version 2')
      expect(version1.documentId).toBe(testDocId)
      expect(version2.documentId).toBe(testDocId)
    })

    it('should delete a version', async () => {
      // Create a version
      const versionData = {
        documentId: testDocId,
        content: JSON.stringify({
          type: 'doc',
          content: [{ 
            type: 'paragraph', 
            content: [{ type: 'text', text: 'Version to delete' }] 
          }]
        }),
        title: 'Version to Delete',
        userId: 'test-user-id'
      }

      const version = await apiService.post(`documents/${testDocId}/versions`, versionData)
      expect(version._id).toBeDefined()

      // Delete the version
      const result = await apiService.destroy(`documents/${testDocId}/versions?versionId=${version._id}`)
      expect(result.success).toBe(true)

      // Verify version file was deleted
      const versionPath = path.join(versionsDir, `${version._id}.json`)
      expect(fs.existsSync(versionPath)).toBe(false)

      // Verify version is not in the list
      const versions = await apiService.get(`documents/${testDocId}/versions`)
      const deletedVersion = versions.find((v: any) => v._id === version._id)
      expect(deletedVersion).toBeUndefined()
    }, 10000)
  })
}) 