import { DocumentData, VersionData } from '@typez/globals'
import axios, { AxiosRequestConfig } from 'axios'
import authService from './auth-service'
import { documentStorage, folderStorage, versionStorage } from './storage-adapter'
import { DEFAULT_DOCUMENT_CONTENT } from '../lib/constants'

// We'll always use local storage and sync with cloud when possible
const BASE_URL = 'https://www.whetstone-writer.com/api'
const DOCUMENTS_COLLECTION = 'documents'
const FOLDERS_COLLECTION = 'folders'

// Check if we're online
const isOnline = () => {
  // For now, always return true while testing
  // In a production app, we'd implement proper network detection
  // Options include:
  // 1. Using Electron's 'online' and 'offline' events
  // 2. Attempting to reach a known server with a lightweight request
  // 3. Using Node.js 'dns' module to resolve a hostname
  return true
}

// Expose the CRUD methods to the renderer
export const electronAPI = {
  create: async (url: string, body: any) => {
    const result = await makeRequest('post', url, body)
    return result.data
  },

  patch: async (url: string, body: any) => {
    const result = await makeRequest('patch', url, body)
    return result.data
  },

  get: async (url: string) => {
    const result = await makeRequest('get', url)
    return result.data
  },

  destroy: async (url: string) => {
    const result = await makeRequest('delete', url)
    return result.data
  }
}

// Export original apiService interface for backward compatibility
const apiService = {
  getDocuments: async () => {
    const result = await makeRequest('get', '/documents')
    return result.data
  },

  getFolders: async () => {
    const result = await makeRequest('get', '/folders')
    return result.data
  },

  deleteDocument: async (id: string) => {
    const result = await makeRequest('delete', `/documents/${id}`)
    return result.data
  },

  updateDocument: async (id: string, data: Partial<DocumentData>) => {
    const result = await makeRequest('patch', `/documents/${id}`, data)
    return result.data
  },

  post: async (url: string, body: any) => {
    const result = await makeRequest('post', url, body)
    return result.data
  },

  patch: async (url: string, body: any) => {
    const result = await makeRequest('patch', url, body)
    return result.data
  },

  get: async (url: string) => {
    const result = await makeRequest('get', url)
    return result.data
  },

  destroy: async (url: string) => {
    const result = await makeRequest('delete', url)
    return result.data
  }
}

export default apiService

const makeRequest = async (
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: Partial<DocumentData | VersionData>,
) => {
  // console.log('\n=== API Request ===')
  // console.log(`Method: ${method.toUpperCase()}`)
  // console.log(`Endpoint: ${endpoint}`)
  // console.log(`Online Mode: ${isOnline() ? 'Connected' : 'Offline'}`)

  // Clean the endpoint
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  console.log(`Cleaned endpoint: ${cleanEndpoint}`)

  try {
    // Always execute local operation first
    let localResult = await performLocalOperation(method, cleanEndpoint, data)
    console.log('Local operation result:', localResult?.data ? 'success' : 'no data')
    
    // If we're online, perform cloud operation in the background without blocking
    if (isOnline()) {
      // Use fire-and-forget pattern - we don't await this
      performCloudOperationAsync(method, endpoint, data, cleanEndpoint)
    } else {
      console.log('Offline mode - using local data only')
    }
    
    // Always return the local result immediately
    return localResult
  } catch (error) {
    console.error(`Error in makeRequest:`, error)
    throw error
  }
}

// Track if a sync operation is in progress
let syncInProgress = {
  documents: false,
  folders: false
}

// Handles all local storage operations
async function performLocalOperation(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any
) {
  console.log('Performing local operation:', { method, endpoint })
    
  // Handle collection-level operations
  if (endpoint === 'documents') {
    console.log('Handling collection-level documents request')
    if (method === 'get') {
      return { data: await documentStorage.find(DOCUMENTS_COLLECTION, {}) }
    }
    if (method === 'post') {
      console.log('Creating new document:', data)
      const now = Date.now()
      const newDocument = await documentStorage.create(DOCUMENTS_COLLECTION, {
        ...data,
        content: data?.content || DEFAULT_DOCUMENT_CONTENT,
        comments: [],
        lastUpdated: now
      })
      console.log('Created document:', newDocument)
      return { data: newDocument }
    }
    return { data: null }
  }
  
  if (endpoint === 'folders') {
    console.log('Handling collection-level folders request')
    if (method === 'get') {
      return { data: await folderStorage.find(FOLDERS_COLLECTION, {}) }
    }
    if (method === 'post') {
      console.log('Creating new folder:', data)
      const now = Date.now()
      const newFolder = await folderStorage.create(FOLDERS_COLLECTION, {
        ...data,
        lastUpdated: now
      })
      console.log('Created folder:', newFolder)
      return { data: newFolder }
    }
    return { data: null }
  }

  // Handle bulk delete operation
  if (endpoint === 'documents/bulk-delete') {
    console.log('Handling bulk delete request')
    if (method === 'post' && data) {
      const { documentIds = [], folderIds = [] } = data as { documentIds: string[], folderIds: string[] }
      console.log('Bulk deleting:', { documentIds, folderIds })

      // Helper function to recursively delete a folder and its contents
      async function deleteFolder(folderId: string) {
        console.log(`Starting to delete folder ${folderId}`)
        
        // Get all documents and subfolders in this folder
        const [docs, subfolders] = await Promise.all([
          documentStorage.find(DOCUMENTS_COLLECTION, { parentId: folderId }),
          documentStorage.find(FOLDERS_COLLECTION, { parentId: folderId })
        ])

        console.log(`Found in folder ${folderId}:`, {
          documentsCount: docs.length,
          subfoldersCount: subfolders.length,
          documents: docs.map(d => d._id),
          subfolders: subfolders.map(f => f._id)
        })

        // Recursively delete all subfolders
        if (subfolders.length > 0) {
          console.log(`Deleting ${subfolders.length} subfolders of ${folderId}`)
          await Promise.all(
            subfolders.map(folder => folder._id ? deleteFolder(folder._id) : Promise.resolve())
          )
        }

        // Delete all documents in this folder
        if (docs.length > 0) {
          console.log(`Deleting ${docs.length} documents from folder ${folderId}`)
          await Promise.all(
            docs.map(doc => doc._id ? 
              documentStorage.delete(DOCUMENTS_COLLECTION, { _id: doc._id }) : 
              Promise.resolve()
            )
          )
        }

        // Finally delete the folder itself
        console.log(`Deleting folder ${folderId}`)
        const result = await documentStorage.delete(FOLDERS_COLLECTION, { _id: folderId })
        if (!result) {
          throw new Error(`Failed to delete folder ${folderId}`)
        }
        return result
      }

      try {
        // Delete all documents
        if (documentIds.length > 0) {
          console.log(`Starting to delete ${documentIds.length} documents`)
          await Promise.all(
            documentIds.map(id => 
              documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id })
            )
          )
        }

        // Delete all folders recursively
        if (folderIds.length > 0) {
          console.log(`Starting to delete ${folderIds.length} folders`)
          await Promise.all(
            folderIds.map(id => deleteFolder(id))
          )
        }

        console.log('Bulk delete operation completed successfully')
        return { data: { success: true } }
      } catch (error: any) {
        console.error('Error during bulk delete:', error)
        return { data: { success: false, error: error.message || 'Unknown error occurred' } }
      }
    }
    return { data: null }
  }

  // Handle version operations - check this before document operations
  const versionMatch = endpoint.match(/^documents\/([^\/]+)\/versions(?:\?versionId=(.+))?$/)
  if (versionMatch) {
    const [, documentId, versionId] = versionMatch
    console.log('Version operation:', { documentId, versionId })

    switch (method) {
      case 'get':
        console.log('Getting versions for document:', documentId)
        return { data: await versionStorage.find('versions', { documentId }) }
      case 'post':
        if (!data) return { data: null }
        console.log('Creating version:', data)
        return { data: await versionStorage.create('versions', data) }
      case 'delete':
        if (!versionId) {
          console.log('No version ID provided for deletion')
          return { data: { success: false, error: 'No version ID provided' } }
        }
        console.log('Deleting version:', { documentId, versionId })
        const success = await versionStorage.delete('versions', { _id: versionId })
        return { data: { success } }
    }
  }

  // Handle document operations
  const documentMatch = endpoint.match(/^documents\/([^\/]+)$/)
  if (documentMatch) {
    const [, id] = documentMatch
    console.log('Document operation:', { id, collection: DOCUMENTS_COLLECTION })
    if (!id) {
      console.log('No document ID found in endpoint')
      return { data: null }
    }

    switch (method) {
      case 'get':
        console.log(`Finding document by ID: ${id} in collection: ${DOCUMENTS_COLLECTION}`)
        const doc = await documentStorage.findById(DOCUMENTS_COLLECTION, id)
        console.log('Document found:', doc ? 'yes' : 'no')
        return { data: doc }
      case 'patch':
        if (!data) return { data: null }
        console.log(`Updating document ${id} in collection ${DOCUMENTS_COLLECTION}:`, data)
        const updateResult = await documentStorage.update(DOCUMENTS_COLLECTION, id, data as Partial<Document>)
        console.log('Document update result:', updateResult)
        return { data: updateResult }
      case 'delete':
        console.log('Attempting to delete document with ID:', id)
        const deleteResult = await documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id })
        console.log('Delete operation result:', deleteResult)
        return { data: { success: deleteResult } }
      case 'post':
        if (!data) return { data: null }
        return { data: await documentStorage.create(DOCUMENTS_COLLECTION, data as Omit<Document, '_id'>) }
    }
  }

  // Handle folder operations
  const folderMatch = endpoint.match(/^folders\/([^\/]+)$/)
  if (folderMatch) {
    const [, id] = folderMatch
    console.log('Folder operation:', { id, collection: FOLDERS_COLLECTION })
    if (!id) {
      console.log('No folder ID found in endpoint')
      return { data: null }
    }

    switch (method) {
      case 'get':
        console.log(`Finding folder by ID: ${id} in collection: ${FOLDERS_COLLECTION}`)
        const folder = await folderStorage.findById(FOLDERS_COLLECTION, id)
        console.log('Folder found:', folder ? 'yes' : 'no')
        return { data: folder }
      case 'patch':
        if (!data) return { data: null }
        console.log(`Updating folder ${id} in collection ${FOLDERS_COLLECTION}:`, data)
        const folderUpdateResult = await folderStorage.update(FOLDERS_COLLECTION, id, data as Partial<Document>)
        console.log('Folder update result:', folderUpdateResult)
        return { data: folderUpdateResult }
      case 'delete':
        console.log('Attempting to delete folder with ID:', id)
        const deleteResult = await folderStorage.delete(FOLDERS_COLLECTION, { _id: id })
        console.log('Delete operation result:', deleteResult)
        return { data: { success: deleteResult } }
      case 'post':
        if (!data) return { data: null }
        return { data: await folderStorage.create(FOLDERS_COLLECTION, data as Omit<Document, '_id'>) }
    }
  }

  // Handle version operations
  if (endpoint.startsWith('versions/')) {
    console.log('Version operation detected')
    const parts = endpoint.split('versions/')[1].split('/')
    console.log('Version parts:', parts)
    if (parts.length === 2) {
      const [, versionId] = parts
      switch (method) {
        case 'get':
          return { data: await versionStorage.findById('versions', versionId) }
        case 'delete':
          return { data: await versionStorage.delete('versions', { _id: versionId }) }
      }
    } else if (parts.length === 1) {
      switch (method) {
        case 'get':
          return { data: await versionStorage.find('versions', { documentId: parts[0] }) }
        case 'post':
          if (!data) return { data: null }
          return { data: await versionStorage.create('versions', data) }
      }
    }
  }

  console.log('No matching local operation found')
  return { data: null }
}

// Handles all cloud API operations
async function performCloudOperation(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any
) {
  console.log('Performing cloud operation:', { method, endpoint })
  
  // Ensure endpoint format is correct for cloud API
  endpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = `${BASE_URL}${endpoint}`
  
  // Get fresh access token
  let token = authService.getAccessToken()
  
  // If we have a token and it's expired, try to refresh
  if (token && authService.isTokenExpired(token)) {
    console.log('Token expired, attempting to refresh...')
    try {
      await authService.refreshTokens()
      token = authService.getAccessToken() // Get fresh token after refresh
      console.log('Token refreshed successfully')
    } catch (error) {
      console.error('Failed to refresh token:', error)
      throw new Error('Authentication expired. Please log in again.')
    }
  }

  if (!token) {
    console.error('No access token available')
    throw new Error('No authentication token available. Please log in.')
  }

  const config: AxiosRequestConfig = {
    headers: {
      'x-whetstone-authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }

  // console.log('Making request to URL:', url)
  // console.log('Request config:', {
  //   method,
  //   url,
  //   headers: config.headers,
  //   data: method === 'post' || method === 'patch' ? data : undefined
  // })

  try {
    if (method === 'patch' || method === 'post') {
      return axios[method](url, data, config)
    }
    return axios[method](url, config)
  } catch (error: any) {
    console.error('API request failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
    })
    throw error
  }
}

function normalizeId(id: any): string {
  if (!id) return ''
  // Convert ObjectId or other objects to string
  return id.toString ? id.toString() : String(id)
}

// Compare two documents for "equality" regardless of ID
function areDocumentsEquivalent(doc1: any, doc2: any): boolean {
  if (!doc1 || !doc2) return false
  
  // Title is a good primary indicator
  if (doc1.title && doc2.title && doc1.title === doc2.title) {
    // If titles match, check other fields that might indicate the same document
    
    // Check parent folder
    const sameParent = doc1.parentId === doc2.parentId
    
    // Check content (first 100 chars to avoid long comparisons)
    let contentSimilar = false
    if (doc1.content && doc2.content) {
      const content1 = typeof doc1.content === 'string' ? doc1.content.substring(0, 100) : ''
      const content2 = typeof doc2.content === 'string' ? doc2.content.substring(0, 100) : ''
      contentSimilar = content1 === content2
    }
    
    // For untitled documents or ones with generic titles, be more strict
    if (doc1.title === 'Untitled' || doc1.title === '') {
      return sameParent && contentSimilar
    }
    
    // For documents with specific titles, parent folder match is a good indicator
    return sameParent || contentSimilar
  }
  
  return false
}

// Improved document hash function
function generateDocHash(doc: any): string {
  // This is a simplified hash - in a real app you might use proper hashing
  if (!doc) return ''
  
  // Create hash from fields that identify uniqueness
  // Make sure the hash isn't too sensitive to small changes
  return [
    doc.title || '',
    doc.parentId || '',
    doc.content ? (typeof doc.content === 'string' ? doc.content.substring(0, 20) : '') : ''
  ].join('|')
}

// Compare two folders for "equality" regardless of ID
function areFoldersEquivalent(folder1: any, folder2: any): boolean {
  if (!folder1 || !folder2) return false
  
  // Name is a good primary indicator
  if (folder1.name && folder2.name && folder1.name === folder2.name) {
    // If names match, check other fields that might indicate the same folder
    
    // Check parent folder
    const sameParent = folder1.parentId === folder2.parentId
    
    // For folders with specific names, parent folder match is a good indicator
    return sameParent
  }
  
  return false
}

// When we get data from the cloud, update our local storage to match
async function syncCloudDataToLocal(endpoint: string, cloudData: any) {
  // Only sync collection-level data for now
  if (endpoint === 'documents' && Array.isArray(cloudData)) {
    // Skip if a sync is already in progress for this collection
    if (syncInProgress.documents) {
      console.log('Skipping documents sync - another sync already in progress')
      return
    }
    
    try {
      // Set sync flag
      syncInProgress.documents = true
      
      console.log('Syncing cloud documents to local storage')
      console.log(`Cloud documents count: ${cloudData.length}`)
      
      // Get local documents
      const localDocs = await documentStorage.find(DOCUMENTS_COLLECTION, {})
      console.log(`Local documents count before sync: ${localDocs.length}`)
      
      // Print debug info for both sets
      console.log('Local document IDs:', localDocs.map(doc => doc._id).slice(0, 5))
      console.log('Cloud document IDs:', cloudData.map(doc => doc._id).slice(0, 5))
      
      // For deeper debugging, log a sample document from each source
      if (localDocs.length > 0) {
        const sampleLocal = localDocs[0]
        console.log('Sample local document structure:', {
          _id: sampleLocal._id,
          title: sampleLocal.title,
          parentId: sampleLocal.parentId,
          contentPreview: typeof sampleLocal.content === 'string' ? sampleLocal.content.substring(0, 50) : typeof sampleLocal.content,
          updatedAt: sampleLocal.updatedAt,
          createdAt: sampleLocal.createdAt
        })
      }
      
      if (cloudData.length > 0) {
        const sampleCloud = cloudData[0]
        console.log('Sample cloud document structure:', {
          _id: sampleCloud._id,
          title: sampleCloud.title,
          parentId: sampleCloud.parentId,
          contentPreview: typeof sampleCloud.content === 'string' ? sampleCloud.content.substring(0, 50) : typeof sampleCloud.content,
          updatedAt: sampleCloud.updatedAt,
          createdAt: sampleCloud.createdAt
        })
      }
      
      // Create maps for faster lookups
      const localDocsById = new Map()
      const localDocsByHash = new Map()
      
      for (const doc of localDocs) {
        if (doc._id) {
          const normalizedId = normalizeId(doc._id)
          localDocsById.set(normalizedId, doc)
          
          // Also index by content hash to catch duplicates with different IDs
          const docHash = generateDocHash(doc)
          if (docHash) {
            localDocsByHash.set(docHash, doc)
          }
        }
      }
      
      console.log(`Map size by ID: ${localDocsById.size}, by hash: ${localDocsByHash.size}`)
      
      // Keep track of documents we process
      let updatedCount = 0
      let createdCount = 0
      let skippedCount = 0
      let duplicateCount = 0
      
      // Process cloud documents
      for (const cloudDoc of cloudData) {
        if (!cloudDoc._id) {
          console.warn('Skipping cloud document without ID:', cloudDoc)
          continue
        }
        
        const normalizedCloudId = normalizeId(cloudDoc._id)
        const cloudDocHash = generateDocHash(cloudDoc)
        
        // Check if we already have this document by ID
        let localDoc = localDocsById.get(normalizedCloudId)
        let isDuplicate = false
        
        // If not found by ID, try to find by content hash
        if (!localDoc && cloudDocHash) {
          const docByHash = localDocsByHash.get(cloudDocHash)
          if (docByHash) {
            console.log(`Found potential duplicate by hash: cloud ID ${cloudDoc._id} matches local ID ${docByHash._id}`)
            localDoc = docByHash
            isDuplicate = true
            duplicateCount++
          } else {
            // Last resort: check each local doc for equivalence
            for (const doc of localDocs) {
              if (areDocumentsEquivalent(cloudDoc, doc)) {
                console.log(`Found equivalent document: cloud ID ${cloudDoc._id} matches local ID ${doc._id}`)
                localDoc = doc
                isDuplicate = true
                duplicateCount++
                break
              }
            }
          }
        }
        
        // Debug info
        console.log(`Processing cloud doc ${cloudDoc._id}, title: "${cloudDoc.title || 'no title'}", parent: ${cloudDoc.parentId || 'none'}, exists locally: ${!!localDoc}, duplicate: ${isDuplicate}`)
        
        if (localDoc) {
          // Document exists locally - only update if cloud version is newer
          if (cloudDoc.updatedAt && localDoc.updatedAt && 
              new Date(cloudDoc.updatedAt).getTime() > new Date(localDoc.updatedAt).getTime()) {
            console.log(`Updating document ${cloudDoc._id} with newer cloud version`)
            await documentStorage.update(DOCUMENTS_COLLECTION, localDoc._id, {
              ...cloudDoc,
              _id: localDoc._id // Keep the local ID to avoid duplication
            })
            updatedCount++
          } else {
            console.log(`Skipping document ${cloudDoc._id}, local version is current or newer`)
            skippedCount++
          }
        } else {
          // Perform one final check before creating - look for any documents with the same title and parent
          const matchByTitleAndParent = localDocs.find(doc => 
            doc.title === cloudDoc.title && doc.parentId === cloudDoc.parentId
          )
          
          if (matchByTitleAndParent) {
            console.log(`Found match by title and parent: cloud ID ${cloudDoc._id} matches local ID ${matchByTitleAndParent._id}`)
            await documentStorage.update(DOCUMENTS_COLLECTION, matchByTitleAndParent._id || '', {
              ...cloudDoc,
              _id: matchByTitleAndParent._id // Keep the local ID
            })
            duplicateCount++
            updatedCount++
          } else {
            // Document doesn't exist locally - create it
            console.log(`Creating new local document from cloud: ${cloudDoc._id}`)
            try {
              await documentStorage.create(DOCUMENTS_COLLECTION, cloudDoc)
              createdCount++
            } catch (error) {
              console.error(`Error creating document ${cloudDoc._id}:`, error)
            }
          }
        }
      }
      
      // Get updated count of local documents
      const updatedLocalDocs = await documentStorage.find(DOCUMENTS_COLLECTION, {})
      console.log(`Local documents count after sync: ${updatedLocalDocs.length}`)
      
      console.log(`Document sync complete. Updated: ${updatedCount}, Created: ${createdCount}, Skipped: ${skippedCount}, Duplicates: ${duplicateCount}`)
    } finally {
      // Always release the sync flag when done
      syncInProgress.documents = false
    }
  }
  
  if (endpoint === 'folders' && Array.isArray(cloudData)) {
    // Skip if a sync is already in progress for this collection
    if (syncInProgress.folders) {
      console.log('Skipping folders sync - another sync already in progress')
      return
    }
    
    try {
      // Set sync flag
      syncInProgress.folders = true
      
      console.log('Syncing cloud folders to local storage')
      console.log(`Cloud folders count: ${cloudData.length}`)
      
      // Get local folders
      const localFolders = await folderStorage.find(FOLDERS_COLLECTION, {})
      console.log(`Local folders count before sync: ${localFolders.length}`)
      
      // Print debug info for both sets
      console.log('Local folder IDs:', localFolders.map(folder => folder._id).slice(0, 5))
      console.log('Cloud folder IDs:', cloudData.map(folder => folder._id).slice(0, 5))
      
      // For deeper debugging, log a sample folder from each source
      if (localFolders.length > 0) {
        const sampleLocal = localFolders[0]
        console.log('Sample local folder structure:', {
          _id: sampleLocal._id,
          name: sampleLocal.name,
          parentId: sampleLocal.parentId,
          updatedAt: sampleLocal.updatedAt,
          createdAt: sampleLocal.createdAt
        })
      }
      
      if (cloudData.length > 0) {
        const sampleCloud = cloudData[0]
        console.log('Sample cloud folder structure:', {
          _id: sampleCloud._id,
          name: sampleCloud.name,
          parentId: sampleCloud.parentId,
          updatedAt: sampleCloud.updatedAt,
          createdAt: sampleCloud.createdAt
        })
      }
      
      // Create maps for faster lookups
      const localFoldersById = new Map()
      
      for (const folder of localFolders) {
        if (folder._id) {
          const normalizedId = normalizeId(folder._id)
          localFoldersById.set(normalizedId, folder)
        }
      }
      
      console.log(`Map size by ID: ${localFoldersById.size}`)
      
      // Keep track of folders we process
      let updatedCount = 0
      let createdCount = 0
      let skippedCount = 0
      let duplicateCount = 0
      
      // Process cloud folders
      for (const cloudFolder of cloudData) {
        if (!cloudFolder._id) {
          console.warn('Skipping cloud folder without ID:', cloudFolder)
          continue
        }
        
        const normalizedCloudId = normalizeId(cloudFolder._id)
        
        // Check if we already have this folder by ID
        let localFolder = localFoldersById.get(normalizedCloudId)
        let isDuplicate = false
        
        // If not found by ID, look for equivalent folders
        if (!localFolder) {
          // Check each local folder for equivalence
          for (const folder of localFolders) {
            if (areFoldersEquivalent(cloudFolder, folder)) {
              console.log(`Found equivalent folder: cloud ID ${cloudFolder._id} matches local ID ${folder._id}`)
              localFolder = folder
              isDuplicate = true
              duplicateCount++
              break
            }
          }
        }
        
        // Debug info
        console.log(`Processing cloud folder ${cloudFolder._id}, name: "${cloudFolder.name || 'no name'}", parent: ${cloudFolder.parentId || 'none'}, exists locally: ${!!localFolder}, duplicate: ${isDuplicate}`)
        
        if (localFolder) {
          // Folder exists locally - only update if cloud version is newer
          if (cloudFolder.updatedAt && localFolder.updatedAt && 
              new Date(cloudFolder.updatedAt).getTime() > new Date(localFolder.updatedAt).getTime()) {
            console.log(`Updating folder ${cloudFolder._id} with newer cloud version`)
            await folderStorage.update(FOLDERS_COLLECTION, localFolder._id, {
              ...cloudFolder,
              _id: localFolder._id // Keep the local ID to avoid duplication
            })
            updatedCount++
          } else {
            console.log(`Skipping folder ${cloudFolder._id}, local version is current or newer`)
            skippedCount++
          }
        } else {
          // Perform one final check before creating - look for any folders with the same name and parent
          const matchByNameAndParent = localFolders.find(folder => 
            folder.name === cloudFolder.name && folder.parentId === cloudFolder.parentId
          )
          
          if (matchByNameAndParent) {
            console.log(`Found match by name and parent: cloud ID ${cloudFolder._id} matches local ID ${matchByNameAndParent._id}`)
            await folderStorage.update(FOLDERS_COLLECTION, matchByNameAndParent._id || '', {
              ...cloudFolder,
              _id: matchByNameAndParent._id // Keep the local ID
            })
            duplicateCount++
            updatedCount++
          } else {
            // Folder doesn't exist locally - create it
            console.log(`Creating new local folder from cloud: ${cloudFolder._id}`)
            try {
              await folderStorage.create(FOLDERS_COLLECTION, cloudFolder)
              createdCount++
            } catch (error) {
              console.error(`Error creating folder ${cloudFolder._id}:`, error)
            }
          }
        }
      }
      
      // Get updated count of local folders
      const updatedLocalFolders = await folderStorage.find(FOLDERS_COLLECTION, {})
      console.log(`Local folders count after sync: ${updatedLocalFolders.length}`)
      
      console.log(`Folder sync complete. Updated: ${updatedCount}, Created: ${createdCount}, Skipped: ${skippedCount}, Duplicates: ${duplicateCount}`)
    } finally {
      // Always release the sync flag when done
      syncInProgress.folders = false
    }
  }
}

// Performs cloud operations asynchronously without blocking
async function performCloudOperationAsync(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string, 
  data?: any,
  cleanEndpoint?: string
) {
  try {
    console.log('Starting background cloud operation...')
    const cloudResult = await performCloudOperation(method, endpoint, data)
    
    // For GET operations, we can still sync data in the background
    // But we need to be careful not to create duplicates
    if (method === 'get' && cloudResult && cloudResult.data && cleanEndpoint) {
      // Handle bulk syncing more carefully depending on the endpoint
      if (cleanEndpoint === 'documents' || cleanEndpoint === 'folders') {
        console.log('Background sync: carefully updating local storage with cloud data')
        await syncCloudDataToLocal(cleanEndpoint, cloudResult.data)
      }
      // For individual item requests, we might just want to update if it exists
      else if (cleanEndpoint.includes('/')) {
        // This is a request for a specific item, handle it differently
        console.log('Background sync for individual item, handled separately')
      }
    }
    
    console.log('Background cloud operation completed successfully')
  } catch (error) {
    console.error('Background cloud operation failed:', error)
    // We don't propagate this error since it's a background operation
  }
}
