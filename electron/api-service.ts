import { DocumentData, VersionData } from '@typez/globals'
import axios, { AxiosRequestConfig } from 'axios'
import authService from './auth-service'
import { documentStorage, folderStorage, versionStorage, characterStorage } from './storage-adapter'
import { DEFAULT_DOCUMENT_CONTENT } from '../lib/constants'
import { isOnline } from './network-detector'
import { BrowserWindow } from 'electron'

// We'll always use local storage and sync with cloud when possible
const BASE_URL = 'https://www.whetstone-writer.com/api'
const DOCUMENTS_COLLECTION = 'documents'
const FOLDERS_COLLECTION = 'folders'
const CHARACTERS_COLLECTION = 'characters'

// Reference to the network detector
let networkDetector: {
  reportNetworkFailure: () => void
  reportNetworkSuccess: () => void
} | null = null

// Function to set the network detector reference
export const setNetworkDetector = (detector: {
  reportNetworkFailure: () => void
  reportNetworkSuccess: () => void
}) => {
  networkDetector = detector
}

// Helper to determine if an error is a network connectivity error
function isNetworkError(error: any): boolean {
  return (
    !error.response && // No response from server
    (error.code === 'ECONNABORTED' || // Connection timeout
      error.code === 'ECONNREFUSED' || // Connection refused
      error.code === 'ENOTFOUND' || // DNS lookup failed
      error.message.includes('Network Error') || // Generic network error
      error.message.includes('timeout')) // Timeout error
  )
}

// Function to normalize ID format to string
function normalizeId(id: any): string {
  if (!id) return ''
  // Convert ObjectId or other objects to string
  return id.toString ? id.toString() : String(id)
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
  },
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

  // Character-related methods
  getCharacters: async () => {
    const result = await makeRequest('get', '/characters')
    return result.data
  },

  getCharacter: async (id: string) => {
    const result = await makeRequest('get', `/characters/${id}`)
    return result.data
  },

  createCharacter: async (data: any) => {
    const result = await makeRequest('post', '/characters', data)
    return result.data
  },

  updateCharacter: async (id: string, data: any) => {
    const result = await makeRequest('patch', `/characters/${id}`, data)
    return result.data
  },

  deleteCharacter: async (id: string) => {
    const result = await makeRequest('delete', `/characters/${id}`)
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
  },
}

export default apiService

const makeRequest = async (
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: Partial<DocumentData | VersionData>,
) => {
  // Clean the endpoint
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
  console.log(`Cleaned endpoint: ${cleanEndpoint}`)

  try {
    // Always execute local operation first
    let localResult = await performLocalOperation(method, cleanEndpoint, data)
    console.log('Local operation result:', localResult?.data ? 'success' : 'no data')

    // If we're online, perform cloud operation in the background without blocking
    if (isOnline()) {
      // Since we're now using the same IDs for both local and cloud,
      // we can simply pass the same endpoint to the cloud operation
      performCloudOperationAsync(method, endpoint, data, cleanEndpoint, localResult)
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
  folders: false,
  characters: false,
}

// Handles all local storage operations
async function performLocalOperation(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any,
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
        lastUpdated: now,
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
        lastUpdated: now,
      })
      console.log('Created folder:', newFolder)
      return { data: newFolder }
    }
    return { data: null }
  }

  // Handle character collection operations
  if (endpoint === 'characters') {
    console.log('Handling collection-level characters request')
    if (method === 'get') {
      return { data: await characterStorage.find(CHARACTERS_COLLECTION, {}) }
    }
    if (method === 'post') {
      console.log('Creating new character:', data)
      const now = Date.now()
      const newCharacter = await characterStorage.create(CHARACTERS_COLLECTION, {
        ...data,
        lastUpdated: now,
      })
      console.log('Created character:', newCharacter)
      return { data: newCharacter }
    }
    return { data: null }
  }

  // Handle bulk delete operation
  if (endpoint === 'documents/bulk-delete') {
    console.log('Handling bulk delete request')
    if (method === 'post' && data) {
      const { documentIds = [], folderIds = [] } = data as { documentIds: string[]; folderIds: string[] }
      console.log('Bulk deleting:', { documentIds, folderIds })

      // Helper function to recursively delete a folder and its contents
      async function deleteFolder(folderId: string) {
        console.log(`Starting to delete folder ${folderId}`)

        // Get all documents and subfolders in this folder
        const [docs, subfolders] = await Promise.all([
          documentStorage.find(DOCUMENTS_COLLECTION, { parentId: folderId }),
          documentStorage.find(FOLDERS_COLLECTION, { parentId: folderId }),
        ])

        console.log(`Found in folder ${folderId}:`, {
          documentsCount: docs.length,
          subfoldersCount: subfolders.length,
          documents: docs.map(d => d._id),
          subfolders: subfolders.map(f => f._id),
        })

        // Recursively delete all subfolders
        if (subfolders.length > 0) {
          console.log(`Deleting ${subfolders.length} subfolders of ${folderId}`)
          await Promise.all(
            subfolders.map(folder => (folder._id ? deleteFolder(folder._id) : Promise.resolve())),
          )
        }

        // Delete all documents in this folder
        if (docs.length > 0) {
          console.log(`Deleting ${docs.length} documents from folder ${folderId}`)
          await Promise.all(
            docs.map(doc =>
              doc._id ? documentStorage.delete(DOCUMENTS_COLLECTION, { _id: doc._id }) : Promise.resolve(),
            ),
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
          await Promise.all(documentIds.map(id => documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id })))
        }

        // Delete all folders recursively
        if (folderIds.length > 0) {
          console.log(`Starting to delete ${folderIds.length} folders`)
          await Promise.all(folderIds.map(id => deleteFolder(id)))
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
        const folderUpdateResult = await folderStorage.update(
          FOLDERS_COLLECTION,
          id,
          data as Partial<Document>,
        )
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

  // Handle character operations
  const characterMatch = endpoint.match(/^characters\/([^\/]+)$/)
  if (characterMatch) {
    const [, id] = characterMatch
    console.log('Character operation:', { id, collection: CHARACTERS_COLLECTION })
    if (!id) {
      console.log('No character ID found in endpoint')
      return { data: null }
    }

    switch (method) {
      case 'get':
        console.log(`Finding character by ID: ${id} in collection: ${CHARACTERS_COLLECTION}`)
        const character = await characterStorage.findById(CHARACTERS_COLLECTION, id)
        console.log('Character found:', character ? 'yes' : 'no')
        return { data: character }
      case 'patch':
        if (!data) return { data: null }
        console.log(`Updating character ${id} in collection ${CHARACTERS_COLLECTION}:`, data)
        const updateResult = await characterStorage.update(CHARACTERS_COLLECTION, id, data)
        console.log('Character update result:', updateResult)
        return { data: updateResult }
      case 'delete':
        console.log('Attempting to delete character with ID:', id)
        const deleteResult = await characterStorage.delete(CHARACTERS_COLLECTION, { _id: id })
        console.log('Delete operation result:', deleteResult)
        return { data: { success: deleteResult } }
      case 'post':
        if (!data) return { data: null }
        return { data: await characterStorage.create(CHARACTERS_COLLECTION, data) }
    }
  }

  console.log('No matching local operation found')
  return { data: null }
}

// Handles all cloud API operations
async function performCloudOperation(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any,
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

      // Check if this was a network error
      if (error && isNetworkError(error) && networkDetector) {
        console.log('Network error detected when refreshing token')
        networkDetector.reportNetworkFailure()
      }

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

  try {
    let response
    if (method === 'patch' || method === 'post') {
      response = await axios[method](url, data, config)
    } else {
      response = await axios[method](url, config)
    }

    // If we successfully made a request and we have the network detector,
    // report that the network is working (especially important if we thought we were offline)
    if (networkDetector && !isOnline()) {
      console.log('API request succeeded while system thought we were offline - reporting success')
      networkDetector.reportNetworkSuccess()
    }

    return response
  } catch (error: any) {
    console.error('API request failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
    })

    // Check if this is a network connectivity error
    if (isNetworkError(error) && networkDetector) {
      console.log('Network error detected during API request:', error.message)
      networkDetector.reportNetworkFailure()
    }

    throw error
  }
}

// In the syncCloudDataToLocal function - simplify to use same IDs
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

      // Create maps for efficient lookups
      const localDocsById = new Map(localDocs.map(doc => [normalizeId(doc._id), doc]))
      const cloudDocsById = new Map(cloudData.map(doc => [normalizeId(doc._id), doc]))

      // Keep track of documents we process
      let updatedCount = 0
      let createdCount = 0
      let skippedCount = 0
      let cloudCreatedCount = 0
      const newDocuments: DocumentData[] = []

      // First sync cloud documents to local
      for (const cloudDoc of cloudData) {
        if (!cloudDoc._id) {
          console.warn('Skipping cloud document without ID:', cloudDoc)
          continue
        }

        const normalizedId = normalizeId(cloudDoc._id)
        const localDoc = localDocsById.get(normalizedId)

        if (localDoc) {
          // Document exists locally - check if cloud version is newer
          if (
            cloudDoc.updatedAt &&
            localDoc.updatedAt &&
            new Date(cloudDoc.updatedAt).getTime() > new Date(localDoc.updatedAt).getTime()
          ) {
            console.log(`Updating document ${cloudDoc._id} with newer cloud version`)
            await documentStorage.update(DOCUMENTS_COLLECTION, cloudDoc._id, cloudDoc)
            newDocuments.push(cloudDoc)
            updatedCount++
          } else {
            console.log(`Skipping document ${cloudDoc._id}, local version is current or newer`)
            skippedCount++
          }
        } else {
          // Document doesn't exist locally - create it with the SAME ID
          console.log(`Creating new local document from cloud with ID: ${cloudDoc._id}`)
          try {
            const newDoc = await documentStorage.create(DOCUMENTS_COLLECTION, {
              ...cloudDoc,
              // Use the same ID as the cloud version
              _id: cloudDoc._id,
            })
            newDocuments.push(newDoc)
            createdCount++
          } catch (error) {
            console.error(`Error creating document ${cloudDoc._id}:`, error)
          }
        }
      }

      // Then sync local documents to cloud
      for (const localDoc of localDocs) {
        if (!localDoc._id) {
          console.warn('Skipping local document without ID:', localDoc)
          continue
        }

        const normalizedId = normalizeId(localDoc._id)
        const cloudDoc = cloudDocsById.get(normalizedId)

        if (!cloudDoc) {
          // Document exists locally but not in cloud - create it in cloud
          console.log(`Creating document in cloud with local ID: ${localDoc._id}`)
          try {
            await performCloudOperation('post', '/documents', {
              ...localDoc,
              _id: localDoc._id, // Ensure we use the same ID
            })
            cloudCreatedCount++
          } catch (error) {
            console.error(`Error creating document ${localDoc._id} in cloud:`, error)
          }
        } else {
          // Document exists in both local and cloud - check if local version is newer
          if (
            localDoc.updatedAt &&
            cloudDoc.updatedAt &&
            new Date(localDoc.updatedAt).getTime() > new Date(cloudDoc.updatedAt).getTime()
          ) {
            // Local document is newer, update cloud version
            console.log(`Updating cloud document ${localDoc._id} with newer local version`)
            try {
              await performCloudOperation('patch', `/documents/${localDoc._id}`, localDoc)
              cloudCreatedCount++ // Reuse this counter for updates too
            } catch (error) {
              console.error(`Error updating document ${localDoc._id} in cloud:`, error)
            }
          }
        }
      }

      console.log(
        `Document sync complete. Updated locally: ${updatedCount}, Created locally: ${createdCount}, Created/Updated in cloud: ${cloudCreatedCount}, Skipped: ${skippedCount}`,
      )

      // If we have new or updated documents, notify all windows
      if (newDocuments.length > 0) {
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('sync:updates', { documents: newDocuments })
          }
        })
      }
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

      // Create maps for efficient lookups
      const localFoldersById = new Map(localFolders.map(folder => [normalizeId(folder._id), folder]))
      const cloudFoldersById = new Map(cloudData.map(folder => [normalizeId(folder._id), folder]))

      // Keep track of folders we process
      let updatedCount = 0
      let createdCount = 0
      let skippedCount = 0
      let cloudCreatedCount = 0
      const newFolders: any[] = []

      // First sync cloud folders to local
      for (const cloudFolder of cloudData) {
        if (!cloudFolder._id) {
          console.warn('Skipping cloud folder without ID:', cloudFolder)
          continue
        }

        const normalizedId = normalizeId(cloudFolder._id)
        const localFolder = localFoldersById.get(normalizedId)

        if (localFolder) {
          // Folder exists locally - check if cloud version is newer
          if (
            cloudFolder.updatedAt &&
            localFolder.updatedAt &&
            new Date(cloudFolder.updatedAt).getTime() > new Date(localFolder.updatedAt).getTime()
          ) {
            console.log(`Updating folder ${cloudFolder._id} with newer cloud version`)
            await folderStorage.update(FOLDERS_COLLECTION, cloudFolder._id, cloudFolder)
            newFolders.push(cloudFolder)
            updatedCount++
          } else {
            console.log(`Skipping folder ${cloudFolder._id}, local version is current or newer`)
            skippedCount++
          }
        } else {
          // Folder doesn't exist locally - create it with the SAME ID
          console.log(`Creating new local folder from cloud with ID: ${cloudFolder._id}`)
          try {
            const newFolder = await folderStorage.create(FOLDERS_COLLECTION, {
              ...cloudFolder,
              // Use the same ID as the cloud version
              _id: cloudFolder._id,
            })
            newFolders.push(newFolder)
            createdCount++
          } catch (error) {
            console.error(`Error creating folder ${cloudFolder._id}:`, error)
          }
        }
      }

      // Then sync local folders to cloud
      for (const localFolder of localFolders) {
        if (!localFolder._id) {
          console.warn('Skipping local folder without ID:', localFolder)
          continue
        }

        const normalizedId = normalizeId(localFolder._id)
        const cloudFolder = cloudFoldersById.get(normalizedId)

        if (!cloudFolder) {
          // Folder exists locally but not in cloud - create it in cloud
          console.log(`Creating folder in cloud with local ID: ${localFolder._id}`)
          try {
            await performCloudOperation('post', '/folders', {
              ...localFolder,
              _id: localFolder._id, // Ensure we use the same ID
            })
            cloudCreatedCount++
          } catch (error) {
            console.error(`Error creating folder ${localFolder._id} in cloud:`, error)
          }
        } else {
          // Folder exists in both local and cloud - check if local version is newer
          if (
            localFolder.updatedAt &&
            cloudFolder.updatedAt &&
            new Date(localFolder.updatedAt).getTime() > new Date(cloudFolder.updatedAt).getTime()
          ) {
            // Local folder is newer, update cloud version
            console.log(`Updating cloud folder ${localFolder._id} with newer local version`)
            try {
              await performCloudOperation('patch', `/folders/${localFolder._id}`, localFolder)
              cloudCreatedCount++ // Reuse this counter for updates too
            } catch (error) {
              console.error(`Error updating folder ${localFolder._id} in cloud:`, error)
            }
          }
        }
      }

      console.log(
        `Folder sync complete. Updated locally: ${updatedCount}, Created locally: ${createdCount}, Created/Updated in cloud: ${cloudCreatedCount}, Skipped: ${skippedCount}`,
      )

      // If we have new or updated folders, notify all windows
      if (newFolders.length > 0) {
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('sync:updates', { folders: newFolders })
          }
        })
      }
    } finally {
      // Always release the sync flag when done
      syncInProgress.folders = false
    }
  }

  if (endpoint === 'characters' && Array.isArray(cloudData)) {
    // Skip if a sync is already in progress for this collection
    if (syncInProgress.characters) {
      console.log('Skipping characters sync - another sync already in progress')
      return
    }

    try {
      // Set sync flag
      syncInProgress.characters = true

      console.log('Syncing cloud characters to local storage')
      console.log(`Cloud characters count: ${cloudData.length}`)

      // Get local characters
      const localCharacters = await characterStorage.find(CHARACTERS_COLLECTION, {})
      console.log(`Local characters count before sync: ${localCharacters.length}`)

      // Create maps for efficient lookups
      const localCharsById = new Map(localCharacters.map(char => [normalizeId(char._id), char]))
      const cloudCharsById = new Map(cloudData.map(char => [normalizeId(char._id), char]))

      // Keep track of characters we process
      let updatedCount = 0
      let createdCount = 0
      let skippedCount = 0
      let cloudCreatedCount = 0
      const newCharacters: any[] = []

      // First sync cloud characters to local
      for (const cloudChar of cloudData) {
        if (!cloudChar._id) {
          console.warn('Skipping cloud character without ID:', cloudChar)
          continue
        }

        const normalizedId = normalizeId(cloudChar._id)
        const localChar = localCharsById.get(normalizedId)

        if (localChar) {
          // Character exists locally - check if cloud version is newer
          if (
            cloudChar.updatedAt &&
            localChar.updatedAt &&
            new Date(cloudChar.updatedAt).getTime() > new Date(localChar.updatedAt).getTime()
          ) {
            console.log(`Updating character ${cloudChar._id} with newer cloud version`)
            await characterStorage.update(CHARACTERS_COLLECTION, cloudChar._id, cloudChar)
            newCharacters.push(cloudChar)
            updatedCount++
          } else {
            console.log(`Skipping character ${cloudChar._id}, local version is current or newer`)
            skippedCount++
          }
        } else {
          // Character doesn't exist locally - create it with the SAME ID
          console.log(`Creating new local character from cloud with ID: ${cloudChar._id}`)
          try {
            const newChar = await characterStorage.create(CHARACTERS_COLLECTION, {
              ...cloudChar,
              // Use the same ID as the cloud version
              _id: cloudChar._id,
            })
            newCharacters.push(newChar)
            createdCount++
          } catch (error) {
            console.error(`Error creating character ${cloudChar._id}:`, error)
          }
        }
      }

      // Then sync local characters to cloud
      for (const localChar of localCharacters) {
        if (!localChar._id) {
          console.warn('Skipping local character without ID:', localChar)
          continue
        }

        const normalizedId = normalizeId(localChar._id)
        const cloudChar = cloudCharsById.get(normalizedId)

        if (!cloudChar) {
          // Character exists locally but not in cloud - create it in cloud
          console.log(`Creating character in cloud with local ID: ${localChar._id}`)
          try {
            await performCloudOperation('post', '/characters', {
              ...localChar,
              _id: localChar._id, // Ensure we use the same ID
            })
            cloudCreatedCount++
          } catch (error) {
            console.error(`Error creating character ${localChar._id} in cloud:`, error)
          }
        } else {
          // Character exists in both local and cloud - check if local version is newer
          if (
            localChar.updatedAt &&
            cloudChar.updatedAt &&
            new Date(localChar.updatedAt).getTime() > new Date(cloudChar.updatedAt).getTime()
          ) {
            // Local character is newer, update cloud version
            console.log(`Updating cloud character ${localChar._id} with newer local version`)
            try {
              await performCloudOperation('patch', `/characters/${localChar._id}`, localChar)
              cloudCreatedCount++ // Reuse this counter for updates too
            } catch (error) {
              console.error(`Error updating character ${localChar._id} in cloud:`, error)
            }
          }
        }
      }

      console.log(
        `Character sync complete. Updated locally: ${updatedCount}, Created locally: ${createdCount}, Created/Updated in cloud: ${cloudCreatedCount}, Skipped: ${skippedCount}`,
      )

      // If we have new or updated characters, notify all windows
      if (newCharacters.length > 0) {
        BrowserWindow.getAllWindows().forEach(window => {
          if (!window.isDestroyed()) {
            window.webContents.send('sync:updates', { characters: newCharacters })
          }
        })
      }
    } finally {
      // Always release the sync flag when done
      syncInProgress.characters = false
    }
  }
}

// Performs cloud operations asynchronously without blocking
async function performCloudOperationAsync(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any,
  cleanEndpoint?: string,
  localResult?: any,
) {
  try {
    console.log('Starting background cloud operation:', { method, endpoint })

    // Ensure ID consistency between local and cloud for document creation
    if (method === 'post' && localResult?.data?._id) {
      // Create a copy of the data with the local document's ID
      const updatedData = data ? { ...data } : {}
      // Ensure we use the same ID for cloud operations
      updatedData._id = localResult.data._id
      console.log('Using local document ID for cloud operation:', localResult.data._id)
      // Use the updated data for the cloud operation
      data = updatedData
    }

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
        // This is a request for a specific item, handled separately
        console.log('Background sync for individual item, handled separately')
      }
    } else if (method !== 'get') {
      // For non-GET operations (mutating operations), log the result
      console.log(
        `Background cloud ${method.toUpperCase()} operation completed:`,
        cloudResult ? 'success' : 'no result',
      )
    }

    console.log('Background cloud operation completed successfully')
  } catch (error) {
    console.error('Background cloud operation failed:', error)
    // We don't propagate this error since it's a background operation
  }
}
