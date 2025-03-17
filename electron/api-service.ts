import { DocumentData, VersionData } from '@typez/globals'
import axios, { AxiosRequestConfig } from 'axios'
import authService from './auth-service'
import {
  documentStorage,
  folderStorage,
  versionStorage,
  characterStorage,
  dialogueStorage,
} from './storage-adapter'
import { DEFAULT_DOCUMENT_CONTENT } from '../lib/constants'
import { isOnline } from './network-detector'
import { BrowserWindow } from 'electron'

// We'll always use local storage and sync with cloud when possible
const BASE_URL = 'https://www.whetstone-writer.com/api'
const DOCUMENTS_COLLECTION = 'documents'
const FOLDERS_COLLECTION = 'folders'
const CHARACTERS_COLLECTION = 'characters'
const DIALOGUE_ENTRIES_COLLECTION = 'dialogue'
const VERSIONS_COLLECTION = 'versions'

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

// Helper function to capitalize first letter
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Helper function to get singular form of a collection name
function getSingular(collectionName: string): string {
  // Handle special cases
  if (collectionName === 'dialogue') return 'dialogueEntry'
  // Default case: remove trailing 's'
  return collectionName.endsWith('s') ? collectionName.slice(0, -1) : collectionName
}

// Track if a sync operation is in progress
let syncInProgress: Record<string, boolean> = {
  documents: false,
  folders: false,
  characters: false,
  dialogue: false,
}

// Define collection configuration interface
interface CollectionConfig {
  name: string // API endpoint name (e.g., 'documents')
  storage: any // Storage adapter reference
  collectionName: string // Storage collection name
  defaultValues?: (data: any) => any // Function to add default values on creation
  specialEndpoints?: Record<string, (method: string, match: RegExpMatchArray, data?: any) => Promise<any>>
}

// Define configurations for each collection
const collections: Record<string, CollectionConfig> = {
  documents: {
    name: 'documents',
    storage: documentStorage,
    collectionName: DOCUMENTS_COLLECTION,
    defaultValues: data => ({
      ...data,
      content: data?.content || DEFAULT_DOCUMENT_CONTENT,
      comments: [],
      lastUpdated: Date.now(),
    }),
    specialEndpoints: {
      // Handle bulk delete operation
      '^documents/bulk-delete$': async (method, match, data) => {
        if (method !== 'post' || !data) return { data: null }

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
            await Promise.all(
              documentIds.map(id => documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id })),
            )
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
      },
      // Handle document versions
      '^documents/([^/]+)/versions(?:\\?versionId=(.+))?$': async (method, match, data) => {
        const [, documentId, versionId] = match
        console.log('Version operation:', { documentId, versionId })

        switch (method) {
          case 'get':
            console.log('Getting versions for document:', documentId)
            return { data: await versionStorage.find(VERSIONS_COLLECTION, { documentId }) }
          case 'post':
            if (!data) return { data: null }
            console.log('Creating version:', data)
            return { data: await versionStorage.create(VERSIONS_COLLECTION, data) }
          case 'delete':
            if (!versionId) {
              console.log('No version ID provided for deletion')
              return { data: { success: false, error: 'No version ID provided' } }
            }
            console.log('Deleting version:', { documentId, versionId })
            const success = await versionStorage.delete(VERSIONS_COLLECTION, { _id: versionId })
            return { data: { success } }
          default:
            return { data: null }
        }
      },
    },
  },
  folders: {
    name: 'folders',
    storage: folderStorage,
    collectionName: FOLDERS_COLLECTION,
    defaultValues: data => ({
      ...data,
      lastUpdated: Date.now(),
    }),
  },
  characters: {
    name: 'characters',
    storage: characterStorage,
    collectionName: CHARACTERS_COLLECTION,
    defaultValues: data => ({
      ...data,
      lastUpdated: Date.now(),
    }),
  },
  dialogue: {
    name: 'dialogue',
    storage: dialogueStorage,
    collectionName: DIALOGUE_ENTRIES_COLLECTION,
    defaultValues: data => ({
      ...data,
      lastUpdated: Date.now(),
    }),
    specialEndpoints: {
      // Handle dialogue entries by character
      '^dialogue/character/(.+)$': async (method, match, data) => {
        const characterId = match[1]
        console.log('Getting dialogue entries for character:', characterId)
        if (method === 'get') {
          return { data: await dialogueStorage.find(DIALOGUE_ENTRIES_COLLECTION, { characterId }) }
        }
        return { data: null }
      },
      // Handle dialogue entries by document
      '^dialogue/document/(.+)$': async (method, match, data) => {
        const documentId = match[1]
        console.log('Getting dialogue entries for document:', documentId)
        if (method === 'get') {
          return { data: await dialogueStorage.find(DIALOGUE_ENTRIES_COLLECTION, { documentId }) }
        }
        return { data: null }
      },
    },
  },
  versions: {
    name: 'versions',
    storage: versionStorage,
    collectionName: VERSIONS_COLLECTION,
    defaultValues: data => ({
      ...data,
      lastUpdated: Date.now(),
    }),
  },
}

// Generic function to handle collection-level GET
async function handleCollectionGet(config: CollectionConfig) {
  return { data: await config.storage.find(config.collectionName, {}) }
}

// Generic function to handle collection-level POST (create)
async function handleCollectionCreate(config: CollectionConfig, data: any) {
  const processedData = config.defaultValues
    ? config.defaultValues(data)
    : { ...data, lastUpdated: Date.now() }

  const newItem = await config.storage.create(config.collectionName, processedData)
  console.log(`Created ${config.name.slice(0, -1)}:`, newItem)
  return { data: newItem }
}

// Generic function to handle entity-level GET
async function handleEntityGet(config: CollectionConfig, id: string) {
  console.log(`Finding ${getSingular(config.name)} by ID: ${id} in collection: ${config.collectionName}`)
  const item = await config.storage.findById(config.collectionName, id)
  console.log(`${capitalize(getSingular(config.name))} found:`, item ? 'yes' : 'no')
  return { data: item }
}

// Generic function to handle entity-level PATCH (update)
async function handleEntityUpdate(config: CollectionConfig, id: string, data: any) {
  if (!data) return { data: null }
  console.log(`Updating ${getSingular(config.name)} ${id} in collection ${config.collectionName}:`, data)
  const updateResult = await config.storage.update(config.collectionName, id, data)
  console.log(`${capitalize(getSingular(config.name))} update result:`, updateResult)
  return { data: updateResult }
}

// Generic function to handle entity-level DELETE
async function handleEntityDelete(config: CollectionConfig, id: string) {
  console.log(`Attempting to delete ${getSingular(config.name)} with ID:`, id)
  const deleteResult = await config.storage.delete(config.collectionName, { _id: id })
  console.log('Delete operation result:', deleteResult)
  return { data: { success: deleteResult } }
}

// Router to map endpoints to handlers
async function routeLocalOperation(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any,
) {
  console.log('Routing local operation:', { method, endpoint })

  // Handle collection-level operations
  for (const [key, config] of Object.entries(collections)) {
    // Check for special endpoints first
    if (config.specialEndpoints) {
      for (const [pattern, handler] of Object.entries(config.specialEndpoints)) {
        const specialMatch = endpoint.match(new RegExp(pattern))
        if (specialMatch) {
          return handler(method, specialMatch, data)
        }
      }
    }

    // Handle collection-level operations
    if (endpoint === config.name) {
      // Collection-level operations
      if (method === 'get') {
        return handleCollectionGet(config)
      }
      if (method === 'post') {
        return handleCollectionCreate(config, data)
      }
      return { data: null }
    }

    // Handle entity-level operations
    const entityMatch = endpoint.match(new RegExp(`^${config.name}/([^/]+)$`))
    if (entityMatch) {
      const [, id] = entityMatch
      if (!id) {
        console.log(`No ${getSingular(config.name)} ID found in endpoint`)
        return { data: null }
      }

      switch (method) {
        case 'get':
          return handleEntityGet(config, id)
        case 'patch':
          return handleEntityUpdate(config, id, data)
        case 'delete':
          return handleEntityDelete(config, id)
        case 'post':
          if (!data) return { data: null }
          return handleCollectionCreate(config, { ...data, _id: id })
      }
    }
  }

  // Handle version operations
  if (endpoint.startsWith('versions/')) {
    const config = collections.versions
    const parts = endpoint.split('versions/')[1].split('/')
    console.log('Version parts:', parts)
    if (parts.length === 2) {
      const [, versionId] = parts
      switch (method) {
        case 'get':
          return { data: await config.storage.findById(config.collectionName, versionId) }
        case 'delete':
          return { data: await config.storage.delete(config.collectionName, { _id: versionId }) }
      }
    } else if (parts.length === 1) {
      switch (method) {
        case 'get':
          return { data: await config.storage.find(config.collectionName, { documentId: parts[0] }) }
        case 'post':
          if (!data) return { data: null }
          return { data: await config.storage.create(config.collectionName, data) }
      }
    }
  }

  console.log('No matching local operation found')
  return { data: null }
}

// Generic function to sync cloud data to local for any collection
async function syncCollectionToLocal(config: CollectionConfig, cloudData: any[]) {
  // Skip if a sync is already in progress for this collection
  if (syncInProgress[config.name]) {
    console.log(`Skipping ${config.name} sync - another sync already in progress`)
    return
  }

  try {
    // Set sync flag
    syncInProgress[config.name] = true

    console.log(`Syncing cloud ${config.name} to local storage`)
    console.log(`Cloud ${config.name} count: ${cloudData.length}`)

    // Get local items
    const localItems = await config.storage.find(config.collectionName, {})
    console.log(`Local ${config.name} count before sync: ${localItems.length}`)

    // Create maps for efficient lookups
    const localItemsById = new Map(localItems.map(item => [normalizeId(item._id), item]))
    const cloudItemsById = new Map(cloudData.map(item => [normalizeId(item._id), item]))

    // Keep track of items we process
    let updatedCount = 0
    let createdCount = 0
    let skippedCount = 0
    let cloudCreatedCount = 0
    const newItems: any[] = []

    // First sync cloud items to local
    for (const cloudItem of cloudData) {
      if (!cloudItem._id) {
        console.warn(`Skipping cloud ${getSingular(config.name)} without ID:`, cloudItem)
        continue
      }

      const normalizedId = normalizeId(cloudItem._id)
      const localItem = localItemsById.get(normalizedId)

      if (localItem) {
        // Item exists locally - check if cloud version is newer
        if (
          cloudItem.updatedAt &&
          localItem.updatedAt &&
          new Date(cloudItem.updatedAt).getTime() > new Date(localItem.updatedAt).getTime()
        ) {
          console.log(`Updating ${getSingular(config.name)} ${cloudItem._id} with newer cloud version`)
          await config.storage.update(config.collectionName, cloudItem._id, cloudItem)
          newItems.push(cloudItem)
          updatedCount++
        } else {
          console.log(
            `Skipping ${getSingular(config.name)} ${cloudItem._id}, local version is current or newer`,
          )
          skippedCount++
        }
      } else {
        // Item doesn't exist locally - create it with the SAME ID
        console.log(`Creating new local ${getSingular(config.name)} from cloud with ID: ${cloudItem._id}`)
        try {
          const newItem = await config.storage.create(config.collectionName, {
            ...cloudItem,
            _id: cloudItem._id,
          })
          newItems.push(newItem)
          createdCount++
        } catch (error) {
          console.error(`Error creating ${getSingular(config.name)} ${cloudItem._id}:`, error)
        }
      }
    }

    // Then sync local items to cloud
    for (const localItem of localItems) {
      if (!localItem._id) {
        console.warn(`Skipping local ${getSingular(config.name)} without ID:`, localItem)
        continue
      }

      const normalizedId = normalizeId(localItem._id)
      const cloudItem = cloudItemsById.get(normalizedId)

      if (!cloudItem) {
        // Item exists locally but not in cloud - create it in cloud
        console.log(`Creating ${getSingular(config.name)} in cloud with local ID: ${localItem._id}`)
        try {
          await performCloudOperation('post', `/${config.name}`, {
            ...localItem,
            _id: localItem._id,
          })
          cloudCreatedCount++
        } catch (error) {
          console.error(`Error creating ${getSingular(config.name)} ${localItem._id} in cloud:`, error)
        }
      } else {
        // Item exists in both local and cloud - check if local version is newer
        if (
          localItem.updatedAt &&
          cloudItem.updatedAt &&
          new Date(localItem.updatedAt).getTime() > new Date(cloudItem.updatedAt).getTime()
        ) {
          // Local item is newer, update cloud version
          console.log(`Updating cloud ${getSingular(config.name)} ${localItem._id} with newer local version`)
          try {
            await performCloudOperation('patch', `/${config.name}/${localItem._id}`, localItem)
            cloudCreatedCount++ // Reuse this counter for updates too
          } catch (error) {
            console.error(`Error updating ${getSingular(config.name)} ${localItem._id} in cloud:`, error)
          }
        }
      }
    }

    console.log(
      `${capitalize(config.name)} sync complete. Updated locally: ${updatedCount}, Created locally: ${createdCount}, Created/Updated in cloud: ${cloudCreatedCount}, Skipped: ${skippedCount}`,
    )

    // If we have new or updated items, notify all windows
    if (newItems.length > 0) {
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('sync:updates', { [config.name]: newItems })
        }
      })
    }
  } finally {
    // Always release the sync flag when done
    syncInProgress[config.name] = false
  }
}

// Function to create standard CRUD methods for a collection
function createCollectionMethods(config: CollectionConfig) {
  const singularName = getSingular(config.name)
  const capitalizedName = capitalize(config.name)
  const capitalizedSingular = capitalize(singularName)

  return {
    [`get${capitalizedName}`]: async () => {
      const result = await makeRequest('get', `/${config.name}`)
      return result.data
    },

    [`get${capitalizedSingular}`]: async (id: string) => {
      const result = await makeRequest('get', `/${config.name}/${id}`)
      return result.data
    },

    [`create${capitalizedSingular}`]: async (data: any) => {
      const result = await makeRequest('post', `/${config.name}`, data)
      return result.data
    },

    [`update${capitalizedSingular}`]: async (id: string, data: any) => {
      const result = await makeRequest('patch', `/${config.name}/${id}`, data)
      return result.data
    },

    [`delete${capitalizedSingular}`]: async (id: string) => {
      const result = await makeRequest('delete', `/${config.name}/${id}`)
      return result.data
    },
  }
}

// Generate the apiService object dynamically
const apiService = {
  // Add the generic CRUD methods
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

  // Add collection-specific methods
  ...Object.values(collections).reduce((acc, config) => {
    return { ...acc, ...createCollectionMethods(config) }
  }, {}),

  // Add special methods for dialogue entries by character/document
  getDialogueEntriesByCharacter: async (characterId: string) => {
    const result = await makeRequest('get', `/dialogue/character/${characterId}`)
    return result.data
  },

  getDialogueEntriesByDocument: async (documentId: string) => {
    const result = await makeRequest('get', `/dialogue/document/${documentId}`)
    return result.data
  },
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
    let localResult = await routeLocalOperation(method, cleanEndpoint, data)
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
  const collectionConfig = Object.values(collections).find(config => config.name === endpoint)

  if (collectionConfig && Array.isArray(cloudData)) {
    await syncCollectionToLocal(collectionConfig, cloudData)
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
      if (
        cleanEndpoint === 'documents' ||
        cleanEndpoint === 'folders' ||
        cleanEndpoint === 'characters' ||
        cleanEndpoint === 'dialogue'
      ) {
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
