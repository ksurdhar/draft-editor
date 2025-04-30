import { DocumentData, VersionData } from '@typez/globals'
import {
  documentStorage,
  folderStorage,
  versionStorage,
  characterStorage,
  dialogueStorage,
} from './storage-adapter'
import { DEFAULT_DOCUMENT_CONTENT } from '../lib/constants'
import { isOnline } from './network-detector'
import {
  performCloudOperationAsync,
  performCloudOperation,
  forceFullSync,
  lastFullSyncTime,
  performEntityCloudSync,
} from './sync-service'
import { computeEntityHash } from '../utils/computeEntityHash'

// We'll always use local storage and sync with cloud when possible
export const BASE_URL = 'https://www.whetstone-writer.com/api'
const DOCUMENTS_COLLECTION = 'documents'
const FOLDERS_COLLECTION = 'folders'
const CHARACTERS_COLLECTION = 'characters'
const DIALOGUE_ENTRIES_COLLECTION = 'dialogue'
const VERSIONS_COLLECTION = 'versions'

// Define collection configuration interface
export interface CollectionConfig {
  name: string // API endpoint name (e.g., 'documents')
  storage: any // Storage adapter reference
  collectionName: string // Storage collection name
  defaultValues?: (data: any) => any // Function to add default values on creation
  specialEndpoints?: Record<string, (method: string, match: RegExpMatchArray, data?: any) => Promise<any>>
}

// Define a basic interface for collection items
export interface CollectionItem {
  _id: string | number
  updatedAt?: string | number | Date
  hash?: string
  [key: string]: any
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
      '^dialogue/character/(.+)$': async (method, match, _data) => {
        const characterId = match[1]
        console.log('Getting dialogue entries for character:', characterId)
        if (method === 'get') {
          return { data: await dialogueStorage.find(DIALOGUE_ENTRIES_COLLECTION, { characterId }) }
        }
        return { data: null }
      },
      // Handle dialogue entries by document
      '^dialogue/document/(.+)$': async (method, match, _data) => {
        const documentId = match[1]
        console.log('Getting dialogue entries for document:', documentId)
        if (method === 'get') {
          return { data: await dialogueStorage.find(DIALOGUE_ENTRIES_COLLECTION, { documentId }) }
        }
        return { data: null }
      },
      // Handle dialogue detection
      '^dialogue/detect$': async (method, match, data) => {
        if (method !== 'post' || !data?.text) {
          console.log('Invalid request for dialogue detection:', { method, data })
          return { data: null }
        }
        console.log('Detecting dialogue in text:', data.text.substring(0, 100) + '...')
        try {
          // Call the Next.js API endpoint instead of the local service
          const cloudResponse = await performCloudOperation('post', '/dialogue/detect', { text: data.text })
          console.log(
            'Dialogue detection (via Next.js API) successful:',
            cloudResponse.data?.dialogues?.length || 0,
            'dialogues found',
          )
          return { data: cloudResponse.data?.dialogues || [] }
        } catch (error: any) {
          console.error('Error in dialogue detection (via Next.js API):', error)
          throw error
        }
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
async function handleCollectionGet(config: CollectionConfig, queryParams: Record<string, string> = {}) {
  const items = await config.storage.find(config.collectionName, {})

  // Handle metadataOnly parameter for documents collection
  if (config.name === 'documents' && queryParams.metadataOnly === 'true') {
    console.log('Applying metadataOnly filter to documents')
    return {
      data: items.map((item: any) => {
        // Create a shallow copy of the item without the content field
        const metadata = { ...item }
        delete metadata.content
        return metadata
      }),
    }
  }

  return { data: items }
}

// Add this comment to the ensureEntityHash function
/**
 * Ensures an entity has a hash, computing one if needed
 * Note: This function only computes a hash if one doesn't already exist.
 * This prevents duplication of hash generation between Next.js API and Electron app.
 *
 * The order of hash generation is:
 * 1. Next.js API adds hashes when documents/folders are created/updated through the web app
 * 2. Electron app respects those hashes and only computes new ones for local-only entities
 * 3. When syncing, we keep the existing hash if available, computing new ones only when needed
 */
function ensureEntityHash(entity: CollectionItem): CollectionItem {
  if (!entity.hash) {
    const hash = computeEntityHash(entity)
    console.log(`Computing hash for entity: ${hash}`)
    return { ...entity, hash }
  }
  return entity
}

// Find the handleCollectionCreate function and modify it to ensure hash is set
async function handleCollectionCreate(config: CollectionConfig, data: any) {
  // Add hash to the data if missing
  let processedData = config.defaultValues ? config.defaultValues(data) : { ...data, lastUpdated: Date.now() }

  // Ensure the entity has a hash
  processedData = ensureEntityHash(processedData)

  const newItem = await config.storage.create(config.collectionName, processedData)
  console.log(`Created ${config.name.slice(0, -1)}:`, newItem)
  return { data: newItem }
}

// Generic function to handle entity-level GET
async function handleEntityGet(
  config: CollectionConfig,
  id: string,
  queryParams: Record<string, string> = {},
) {
  console.log(`Finding ${getSingular(config.name)} by ID: ${id} in collection: ${config.collectionName}`)
  const item = await config.storage.findById(config.collectionName, id)
  console.log(`${capitalize(getSingular(config.name))} found:`, item ? 'yes' : 'no')

  // Handle metadataOnly parameter for documents collection
  if (config.name === 'documents' && queryParams.metadataOnly === 'true' && item) {
    console.log('Applying metadataOnly filter to document')
    const metadata = { ...item }
    delete metadata.content
    return { data: metadata }
  }

  return { data: item }
}

// Find the handleEntityUpdate function and modify it to ensure hash is set
async function handleEntityUpdate(config: CollectionConfig, id: string, data: any) {
  if (!data) return { data: null }

  // If we're directly updating the hash field, use that
  if (data.hash) {
    console.log(
      `Updating ${getSingular(config.name)} ${id} in collection ${config.collectionName} with provided hash:`,
      data.hash,
    )
    const updateResult = await config.storage.update(config.collectionName, id, data)
    console.log(`${capitalize(getSingular(config.name))} update result:`, updateResult)
    return { data: updateResult }
  }

  // For other updates, we need to get the current item first to compute an updated hash
  const currentItem = await config.storage.findById(config.collectionName, id)
  if (!currentItem) {
    console.log(`${getSingular(config.name)} ${id} not found for update`)
    return { data: null }
  }

  // Merge current item with updates
  const updatedItem = { ...currentItem, ...data }

  // Ensure hash is set on the merged item
  const itemWithHash = ensureEntityHash(updatedItem)

  // Only include the hash in our update if it changed or wasn't present
  if (itemWithHash.hash !== currentItem.hash) {
    data.hash = itemWithHash.hash
    console.log(`Updating hash for ${getSingular(config.name)} ${id} to:`, data.hash)
  }

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

  // Parse query parameters
  let baseEndpoint = endpoint
  const queryParams: Record<string, string> = {}

  if (endpoint.includes('?')) {
    const [path, queryString] = endpoint.split('?')
    baseEndpoint = path

    // Parse each query parameter
    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=')
      if (key && value) {
        queryParams[key] = decodeURIComponent(value)
      }
    })

    console.log('Parsed query parameters:', queryParams)
  }

  // Handle collection-level operations
  for (const config of Object.values(collections)) {
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
    if (baseEndpoint === config.name) {
      // Collection-level operations
      if (method === 'get') {
        return handleCollectionGet(config, queryParams)
      }
      if (method === 'post') {
        return handleCollectionCreate(config, data)
      }
      return { data: null }
    }

    // Handle entity-level operations
    const entityMatch = baseEndpoint.match(new RegExp(`^${config.name}/([^/]+)$`))
    if (entityMatch) {
      const [, id] = entityMatch
      if (!id) {
        console.log(`No ${getSingular(config.name)} ID found in endpoint`)
        return { data: null }
      }

      switch (method) {
        case 'get':
          return handleEntityGet(config, id, queryParams)
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
  if (baseEndpoint.startsWith('versions/')) {
    const config = collections.versions
    const parts = baseEndpoint.split('versions/')[1].split('/')
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

    // If we're online, perform cloud operation (including dialogue detection now)
    if (isOnline()) {
      // Check if this is a collection GET request that should trigger sync
      if (
        method === 'get' &&
        (cleanEndpoint === 'documents' ||
          cleanEndpoint.startsWith('documents?') ||
          cleanEndpoint === 'folders' ||
          cleanEndpoint === 'characters')
      ) {
        // Extract the base collection name without query params
        const collectionName = cleanEndpoint.split('?')[0]

        // Check if we need to perform a full sync for this collection
        const FULL_SYNC_INTERVAL = 5000 // 5 seconds
        const lastSyncTime = lastFullSyncTime?.[collectionName] || 0
        const now = Date.now()

        if (now - lastSyncTime > FULL_SYNC_INTERVAL) {
          console.log(`Collection ${collectionName} hasn't been fully synced recently, triggering sync...`)

          // We need a short delay to ensure collections are fully defined
          setTimeout(() => {
            forceFullSync(collections, collectionName)
          }, 100)
        } else {
          console.log(
            `Collection ${collectionName} was synced ${Math.round((now - lastSyncTime) / 1000)}s ago, using background sync`,
          )

          // Since we're now using the same IDs for both local and cloud,
          // we can simply pass the same endpoint to the cloud operation
          performCloudOperationAsync(method, endpoint, data, cleanEndpoint, localResult, collections)
        }
      }
      // Check if this is an individual entity GET request
      else if (
        method === 'get' &&
        (cleanEndpoint.match(/^documents\/[^\/]+$/) ||
          cleanEndpoint.match(/^folders\/[^\/]+$/) ||
          cleanEndpoint.match(/^characters\/[^\/]+$/))
      ) {
        // Extract entity ID and collection name
        const [collectionName, entityId] = cleanEndpoint.split('/')
        console.log(`Individual ${collectionName} entity request for ID: ${entityId}`)

        // Perform cloud operation to get the latest version
        // but don't wait for it - let the local result return immediately
        const prioritizeFresh = true

        performEntityCloudSync(collectionName, entityId, localResult.data, collections, prioritizeFresh)

        // We'll still return the local result immediately for responsiveness
        // The UI will update when the cloud sync completes if needed
      } else {
        // For other endpoints, use normal async cloud operation
        performCloudOperationAsync(method, endpoint, data, cleanEndpoint, localResult, collections)
      }
    } else {
      console.log('Skipping cloud sync - offline')
    }

    // Always return the local result immediately
    return localResult
  } catch (error) {
    console.error(`Error in makeRequest:`, error)
    throw error
  }
}
