import { AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { BrowserWindow } from 'electron'
import authService from './auth-service'
import { isOnline } from './network-detector'
import { computeEntityHash } from '../utils/computeEntityHash'

// Import types and interfaces from api-service
import { BASE_URL, CollectionConfig, CollectionItem } from './api-service'

// Reference to the network detector
let networkDetector: {
  reportNetworkFailure: () => void
  reportNetworkSuccess: () => void
} | null = null

// Flag to indicate app is in startup process
let isAppStartup = true

// Function to set the network detector reference
export const setNetworkDetector = (detector: {
  reportNetworkFailure: () => void
  reportNetworkSuccess: () => void
}) => {
  networkDetector = detector
}

// Helper to determine if an error is a network connectivity error
export function isNetworkError(error: any): boolean {
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

// Track if a sync operation is in progress
let syncInProgress: Record<string, boolean> = {
  documents: false,
  folders: false,
  characters: false,
}

// Track results of sync operations
let syncResults: Record<string, { timestamp: number; updatedCount: number }> = {
  last_sync_documents: { timestamp: 0, updatedCount: 0 },
  last_sync_folders: { timestamp: 0, updatedCount: 0 },
  last_sync_characters: { timestamp: 0, updatedCount: 0 },
}

// Track recently synced items to prevent ping-pong effect
const recentlySyncedFromCloud: Record<string, Set<string>> = {
  documents: new Set(),
  folders: new Set(),
  characters: new Set(),
}

// Clear recent sync flags after some time
function clearRecentSyncFlag(collection: string, id: string) {
  setTimeout(() => {
    if (recentlySyncedFromCloud[collection]) {
      recentlySyncedFromCloud[collection].delete(id)
    }
  }, 30000) // Clear after 30 seconds
}

// Function to mark app startup as complete
export function completeAppStartup() {
  isAppStartup = false
  console.log('App startup phase complete, normal sync throttling enabled')
}

// Function to force a full sync of all collections
export async function forceFullSync(collections: Record<string, CollectionConfig>) {
  console.log('Forcing full sync of all collections')

  // Reset sync results to force sync
  syncResults = {
    last_sync_documents: { timestamp: 0, updatedCount: 0 },
    last_sync_folders: { timestamp: 0, updatedCount: 0 },
    last_sync_characters: { timestamp: 0, updatedCount: 0 },
  }

  // Set startup flag to bypass throttling
  isAppStartup = true

  try {
    // Request each collection to trigger sync
    const endpoints = ['documents', 'folders', 'characters']
    for (const endpoint of endpoints) {
      console.log(`Forcing sync for collection: ${endpoint}`)
      try {
        const cloudResult = await performCloudOperation('get', `/${endpoint}`)
        if (cloudResult && cloudResult.data) {
          await syncCloudDataToLocal(endpoint, cloudResult.data, collections)
        }
      } catch (error) {
        console.error(`Error during forced sync of ${endpoint}:`, error)
      }
    }
  } finally {
    // Reset app startup flag after sync
    completeAppStartup()
  }
}

// Modify the performCloudOperation function to ensure entities have hashes
export async function performCloudOperation(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any,
) {
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
      // Only process data if it's an object and for relevant endpoints
      if (
        data &&
        typeof data === 'object' &&
        (endpoint.includes('/documents') || endpoint.includes('/folders') || endpoint.includes('/characters'))
      ) {
        // If the data doesn't already have a hash, compute one
        if (!data.hash && data._id) {
          data = ensureEntityHash(data as CollectionItem)
          console.log(`Added hash to ${method} operation for ${endpoint}:`, data.hash)
        }
      }

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
      data: error.response?.data,
    })

    // Check if this is a network connectivity error
    if (isNetworkError(error) && networkDetector) {
      console.log('Network error detected during API request:', error.message)
      networkDetector.reportNetworkFailure()
    }

    throw error
  }
}

/**
 * Ensures an entity has a hash, computing one if needed
 * Note: This function only computes a hash if one doesn't already exist.
 * This prevents duplication of hash generation between Next.js API and Electron app.
 */
function ensureEntityHash(entity: CollectionItem): CollectionItem {
  if (!entity.hash) {
    // Entity doesn't have a hash, compute and add it
    const hash = computeEntityHash(entity)
    console.log(`Computing hash for entity ${entity._id}: ${hash}`)
    return { ...entity, hash }
  }
  return entity
}

// Update the syncCollectionToLocal function to check and add hashes on the fly
export async function syncCollectionToLocal(config: CollectionConfig, cloudData: CollectionItem[]) {
  // Skip if a sync is already in progress for this collection
  if (syncInProgress[config.name] && !isAppStartup) {
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
    const localItemsById = new Map(localItems.map((item: CollectionItem) => [normalizeId(item._id), item]))
    const cloudItemsById = new Map(cloudData.map((item: CollectionItem) => [normalizeId(item._id), item]))

    // Keep track of items we process
    let updatedCount = 0
    let createdCount = 0
    let skippedCount = 0
    let cloudCreatedCount = 0
    let hashAddedCount = 0
    const newItems: any[] = []

    // For debugging, temporarily limit to 2 folders if this is a folder sync
    let itemsToProcess = cloudData

    // First sync cloud items to local
    for (const cloudItem of itemsToProcess) {
      if (!cloudItem._id) {
        console.warn(`Skipping cloud ${getSingular(config.name)} without ID:`, cloudItem)
        continue
      }

      // Ensure cloud item has a hash
      const cloudItemWithHash = ensureEntityHash(cloudItem)
      if (cloudItemWithHash.hash !== cloudItem.hash) {
        hashAddedCount++
        // Update the cloud item with the hash if needed
        try {
          await performCloudOperation('patch', `/${config.name}/${cloudItem._id}`, {
            hash: cloudItemWithHash.hash,
          })
          console.log(
            `Added hash to cloud ${getSingular(config.name)} ${cloudItem._id}: ${cloudItemWithHash.hash}`,
          )
        } catch (error) {
          console.error(`Error updating hash for cloud ${getSingular(config.name)} ${cloudItem._id}:`, error)
        }
      }

      const normalizedId = normalizeId(cloudItem._id)
      let localItem = localItemsById.get(normalizedId) as CollectionItem | undefined

      if (localItem) {
        // Ensure local item has a hash
        if (!localItem.hash) {
          localItem = ensureEntityHash(localItem)
          hashAddedCount++
          // Update the local item with the hash
          await config.storage.update(config.collectionName, String(localItem._id), { hash: localItem.hash })
          console.log(`Added hash to local ${getSingular(config.name)} ${localItem._id}: ${localItem.hash}`)
        }

        // Item exists locally - check if cloud version is different based on hash
        const cloudHash = cloudItemWithHash.hash || ''
        const localHash = localItem.hash || ''

        const hashesDiffer = cloudHash !== localHash && cloudHash !== ''

        if (hashesDiffer) {
          console.log(
            `Updating ${getSingular(config.name)} ${cloudItem._id} with different cloud version - hash mismatch (local: ${localHash}, cloud: ${cloudHash})`,
          )

          // FIX: Ensure lastUpdated is preserved and synchronized with the cloud's updatedAt
          const updatedItem = {
            ...cloudItemWithHash,
            lastUpdated: cloudItemWithHash.updatedAt
              ? new Date(cloudItemWithHash.updatedAt).getTime()
              : Date.now(),
          }
          await config.storage.update(config.collectionName, String(cloudItem._id), updatedItem)

          // Mark this item as recently synced from cloud to prevent ping-pong updates
          if (recentlySyncedFromCloud[config.name]) {
            recentlySyncedFromCloud[config.name].add(normalizedId)
            clearRecentSyncFlag(config.name, normalizedId)
          }

          // DEBUG: Verify the lastUpdated was properly set after the update
          const verifyItem = await config.storage.findById(config.collectionName, cloudItem._id)
          console.log(`DEBUG: After update, ${getSingular(config.name)} ${cloudItem._id} has:`, {
            lastUpdated: verifyItem.lastUpdated,
            hasLastUpdated: !!verifyItem.lastUpdated,
            updatedAt: verifyItem.updatedAt,
            hasUpdatedAt: !!verifyItem.updatedAt,
            hash: verifyItem.hash,
          })

          // FIX: Also keep the newItems array consistent with what we stored
          newItems.push(updatedItem)
          updatedCount++
        } else {
          // Items are the same according to hash comparison
          skippedCount++
        }
      } else {
        // Item doesn't exist locally - create it with the SAME ID
        console.log(`Creating new local ${getSingular(config.name)} from cloud with ID: ${cloudItem._id}`)
        try {
          // FIX: Ensure lastUpdated and hash are properly set when creating new items
          const newItemData: CollectionItem & { hash?: string; lastUpdated: number } = {
            ...cloudItemWithHash,
            _id: cloudItem._id,
            lastUpdated: cloudItemWithHash.updatedAt
              ? new Date(cloudItemWithHash.updatedAt).getTime()
              : Date.now(),
          }

          const newItem = await config.storage.create(config.collectionName, newItemData)

          // Mark this item as recently synced from cloud
          if (recentlySyncedFromCloud[config.name]) {
            recentlySyncedFromCloud[config.name].add(normalizedId)
            clearRecentSyncFlag(config.name, normalizedId)
          }

          newItems.push(newItem) // Notify with the newly created local item structure
          createdCount++
        } catch (error) {
          console.error(`Error creating ${getSingular(config.name)} ${cloudItem._id}:`, error)
        }
      }
    }

    // Then sync local items to cloud
    for (const originalLocalItem of localItems) {
      if (!originalLocalItem._id) {
        console.warn(`Skipping local ${getSingular(config.name)} without ID:`, originalLocalItem)
        continue
      }

      // Ensure local item has a hash
      let localItem = originalLocalItem
      if (!localItem.hash) {
        localItem = ensureEntityHash(localItem)
        hashAddedCount++
        // Update the local item with the hash
        await config.storage.update(config.collectionName, String(localItem._id), { hash: localItem.hash })
        console.log(`Added hash to local ${getSingular(config.name)} ${localItem._id}: ${localItem.hash}`)
      }

      const normalizedId = normalizeId(localItem._id)
      const cloudItem = cloudItemsById.get(normalizedId)

      // Skip if this item was recently updated from cloud to avoid ping-pong
      if (recentlySyncedFromCloud[config.name]?.has(normalizedId)) {
        console.log(
          `Skipping cloud update for ${getSingular(config.name)} ${localItem._id} - recently synced from cloud`,
        )
        continue
      }

      if (!cloudItem) {
        // Item exists locally but not in cloud - create it in cloud
        console.log(`Creating ${getSingular(config.name)} in cloud with local ID: ${localItem._id}`)
        try {
          // Send local data (including hash) to cloud
          await performCloudOperation('post', `/${config.name}`, {
            ...localItem,
            _id: localItem._id, // Ensure cloud uses the same ID
          })
          cloudCreatedCount++
        } catch (error) {
          console.error(`Error creating ${getSingular(config.name)} ${localItem._id} in cloud:`, error)
        }
      } else {
        // Item exists in both local and cloud - check if they differ by hash
        // Ensure cloud item has a hash
        let cloudItemWithHash = cloudItem
        if (!cloudItemWithHash.hash) {
          cloudItemWithHash = ensureEntityHash(cloudItem)
          hashAddedCount++
          // Update the cloud item with the hash
          try {
            await performCloudOperation('patch', `/${config.name}/${cloudItem._id}`, {
              hash: cloudItemWithHash.hash,
            })
            console.log(
              `Added hash to cloud ${getSingular(config.name)} ${cloudItem._id}: ${cloudItemWithHash.hash}`,
            )
          } catch (error) {
            console.error(
              `Error updating hash for cloud ${getSingular(config.name)} ${cloudItem._id}:`,
              error,
            )
          }
        }

        const localHash = localItem.hash || ''
        const cloudHash = cloudItemWithHash.hash || ''

        const hashesDiffer = localHash !== cloudHash && localHash !== ''

        if (hashesDiffer) {
          // Local item has a different hash, update cloud version
          console.log(
            `Updating cloud ${getSingular(config.name)} ${localItem._id} with different local version - hash mismatch (local: ${localHash}, cloud: ${cloudHash})`,
          )
          try {
            // Send local data (including hash) to cloud
            await performCloudOperation('patch', `/${config.name}/${localItem._id}`, {
              ...localItem,
              updatedAt: localItem.lastUpdated, // Ensure cloud updatedAt matches local lastUpdated
            })
            cloudCreatedCount++ // Reuse this counter for updates too
          } catch (error) {
            console.error(
              `Error updating ${getSingular(config.name)} ${localItem._id} in cloud:`,
              (error as any)?.response?.data || error, // Log response data if available
            )
          }
        }
      }
    }

    // Record sync results for throttling future operations
    const lastSyncKey = `last_sync_${config.name}` as keyof typeof syncResults
    syncResults[lastSyncKey] = {
      timestamp: Date.now(),
      updatedCount: updatedCount + createdCount,
    }
    console.log(`DEBUG: Recorded sync results for ${config.name}:`, syncResults[lastSyncKey])

    console.log(
      `${capitalize(config.name)} sync complete. Updated locally: ${updatedCount}, Created locally: ${createdCount}, Created/Updated in cloud: ${cloudCreatedCount}, Skipped: ${skippedCount}, Hashes added: ${hashAddedCount}`,
    )

    // If we have new or updated items, notify all windows
    if (newItems.length > 0) {
      console.log(`DEBUG: Sending sync:updates for ${config.name} with ${newItems.length} items`)
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          console.log('sync:updates called')
          // Send the *new local state* or *cloud state that triggered update*
          // Using newItems which currently holds cloud data for updates, local data for creates.
          // Consider fetching the updated local item after storage.update for consistency if needed.
          window.webContents.send('sync:updates', { [config.name]: newItems })
        }
      })
    } else {
      console.log(`DEBUG: No sync:updates sent for ${config.name} - no new items detected`)
    }
  } finally {
    // Always release the sync flag when done
    syncInProgress[config.name] = false
  }
}

// In the syncCloudDataToLocal function - simplify to use same IDs
export async function syncCloudDataToLocal(
  endpoint: string,
  cloudData: any,
  collections: Record<string, CollectionConfig>,
) {
  // Only sync collection-level data for now
  const collectionConfig = Object.values(collections).find(config => config.name === endpoint)

  if (collectionConfig && Array.isArray(cloudData)) {
    await syncCollectionToLocal(collectionConfig, cloudData)
  }
}

// Performs cloud operations asynchronously without blocking
export async function performCloudOperationAsync(
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: any,
  cleanEndpoint?: string,
  localResult?: any,
  collections?: Record<string, CollectionConfig>,
) {
  try {
    console.trace('Starting background cloud operation:', { method, endpoint })

    // Ensure ID consistency between local and cloud for document creation
    if (method === 'post' && localResult?.data?._id) {
      // Create a copy of the data with the local document's ID
      const updatedData = data ? { ...data } : {}
      // Ensure we use the same ID for cloud operations
      updatedData._id = localResult.data._id
      console.log('Using local document ID for cloud operation:', localResult.data._id)

      // Ensure we have a hash when creating a new item
      if (
        !updatedData.hash &&
        (endpoint.includes('/documents') || endpoint.includes('/folders') || endpoint.includes('/characters'))
      ) {
        updatedData.hash = computeEntityHash(updatedData)
        console.log(`Added hash to async cloud operation: ${updatedData.hash}`)
      }

      // Use the updated data for the cloud operation
      data = updatedData
    }

    const cloudResult = await performCloudOperation(method, endpoint, data)

    // For GET operations, we can still sync data in the background
    // But we need to be careful not to create duplicates
    if (method === 'get' && cloudResult && cloudResult.data && cleanEndpoint && collections) {
      // Handle bulk syncing more carefully depending on the endpoint
      if (cleanEndpoint === 'documents' || cleanEndpoint === 'folders' || cleanEndpoint === 'characters') {
        console.log('Background sync: carefully updating local storage with cloud data')

        // During app startup, bypass throttling to ensure sync happens
        if (isAppStartup) {
          console.log(`App startup detected: Bypassing throttling for ${cleanEndpoint} sync`)
          await syncCloudDataToLocal(cleanEndpoint, cloudResult.data, collections)
          return
        }

        // Add a condition to only sync if there's a reasonable expectation of changes
        // Check if we've recently synced this collection and no changes were detected
        if (syncInProgress[cleanEndpoint]) {
          console.log(`Background sync: Skipping ${cleanEndpoint} sync - already in progress`)
          return
        }

        // Check if we had a very recent sync with no changes
        const lastSyncKey = `last_sync_${cleanEndpoint}`
        const lastSyncTime = syncResults[lastSyncKey]?.timestamp || 0
        const lastSyncUpdates = syncResults[lastSyncKey]?.updatedCount || 0
        const now = Date.now()

        // If we had a sync with no updates in the last 10 seconds, skip this sync
        const MIN_SYNC_INTERVAL = 10000 // 10 seconds
        if (lastSyncTime > 0 && now - lastSyncTime < MIN_SYNC_INTERVAL && lastSyncUpdates === 0) {
          console.log(
            `Background sync: Skipping ${cleanEndpoint} sync - recent sync with no changes (${now - lastSyncTime}ms ago)`,
          )
          return
        }

        // Proceed with sync
        await syncCloudDataToLocal(cleanEndpoint, cloudResult.data, collections)
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

// Helper function to get singular form of a collection name
function getSingular(collectionName: string): string {
  // Handle special cases
  if (collectionName === 'dialogue') return 'dialogueEntry'
  // Default case: remove trailing 's'
  return collectionName.endsWith('s') ? collectionName.slice(0, -1) : collectionName
}

// Helper function to capitalize first letter
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
