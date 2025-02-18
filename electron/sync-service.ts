import * as Y from 'yjs'
import { MongoStorageAdapter } from '../lib/storage/mongo-storage'
import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import { Document, JsonDocument } from '../lib/storage/types'
import authService from './auth-service'

interface YjsContent {
  type: 'yjs'
  state: number[]
}

interface DocumentWithYjsContent extends Document {
  content: YjsContent
}

export class SyncService {
  private mongoStorage: MongoStorageAdapter
  private localStorage: YjsStorageAdapter
  private syncQueue: Set<string>
  private isSyncing: boolean
  private lastSyncTime: Date
  private syncInterval: NodeJS.Timeout | null = null
  private isInitialized: boolean = false

  constructor(localStorage: YjsStorageAdapter, mongoStorage: MongoStorageAdapter) {
    this.localStorage = localStorage
    this.mongoStorage = mongoStorage
    this.syncQueue = new Set()
    this.isSyncing = false
    this.lastSyncTime = new Date(0) // Start with epoch time
  }

  async initialize() {
    if (this.isInitialized) return

    try {
      // Set the user ID from the Auth0 profile
      const profile = authService.getProfile()
      if (!profile?.sub) {
        throw new Error('No user profile available')
      }
      this.mongoStorage.setUserId(profile.sub)

      // Initial sync from MongoDB to local
      console.log('Performing initial sync from MongoDB...')
      const remoteDocuments = await this.mongoStorage.find('documents', {})
      console.log(`Found ${remoteDocuments.length} documents in MongoDB`)

      for (const doc of remoteDocuments) {
        if (doc._id) {
          const localDoc = await this.localStorage.findById('documents', doc._id)
          if (!localDoc) {
            // Document doesn't exist locally, create it
            console.log(`Creating local copy of document ${doc._id}`)
            await this.localStorage.create('documents', doc)
          } else {
            // Document exists locally, queue for merge
            this.queueForSync(doc._id)
          }
        }
      }

      // Start periodic sync
      this.startPeriodicSync()
      this.isInitialized = true
      console.log('Sync service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize sync service:', error)
      throw error
    }
  }

  startPeriodicSync(intervalMs: number = 5 * 60 * 1000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }

    this.syncInterval = setInterval(() => {
      this.syncAll().catch(error => {
        console.error('Error during periodic sync:', error)
      })
    }, intervalMs)

    console.log(`Periodic sync started with interval of ${intervalMs}ms`)
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('Periodic sync stopped')
    }
  }

  // Queue a document for sync
  queueForSync(documentId: string) {
    this.syncQueue.add(documentId)
    this.processSyncQueue() // Try to process queue
  }

  // Process the sync queue
  private async processSyncQueue() {
    if (this.isSyncing || this.syncQueue.size === 0) return

    this.isSyncing = true
    try {
      for (const docId of Array.from(this.syncQueue)) {
        await this.syncDocument(docId)
        this.syncQueue.delete(docId)
      }
    } catch (error) {
      console.error('Error processing sync queue:', error)
    } finally {
      this.isSyncing = false
    }
  }

  // Sync a single document
  private async syncDocument(documentId: string) {
    console.log(`Syncing document ${documentId}...`)
    try {
      // Get local version
      const localDoc = await this.localStorage.findById('documents', documentId) as DocumentWithYjsContent
      if (!localDoc) {
        console.log(`Local document ${documentId} not found`)
        return
      }

      // Get remote version
      const remoteDoc = await this.mongoStorage.findById('documents', documentId) as DocumentWithYjsContent

      if (!remoteDoc) {
        // Document doesn't exist remotely, create it
        console.log(`Creating remote copy of document ${documentId}`)
        await this.mongoStorage.create('documents', localDoc)
        return
      }

      // Both documents exist, merge their content using YJS
      const localYDoc = new Y.Doc()
      const remoteYDoc = new Y.Doc()

      // Apply local state
      if (localDoc.content?.type === 'yjs' && Array.isArray(localDoc.content.state)) {
        Y.applyUpdate(localYDoc, new Uint8Array(localDoc.content.state))
      }

      // Apply remote state
      if (remoteDoc.content?.type === 'yjs' && Array.isArray(remoteDoc.content.state)) {
        Y.applyUpdate(remoteYDoc, new Uint8Array(remoteDoc.content.state))
      }

      // Merge changes
      Y.applyUpdate(localYDoc, Y.encodeStateAsUpdate(remoteYDoc))

      // Update both storages with merged state
      const mergedState = Array.from(Y.encodeStateAsUpdate(localYDoc))
      const mergedContent: YjsContent = {
        type: 'yjs',
        state: mergedState
      }

      const updates = await Promise.all([
        this.localStorage.update('documents', documentId, { 
          ...localDoc,
          content: mergedContent,
          updatedAt: new Date().toISOString()
        }),
        this.mongoStorage.update('documents', documentId, {
          ...remoteDoc,
          content: mergedContent,
          updatedAt: new Date().toISOString()
        })
      ])

      console.log(`Successfully synced document ${documentId}`)
      return updates

    } catch (error) {
      console.error(`Error syncing document ${documentId}:`, error)
      // Re-queue for later retry
      this.syncQueue.add(documentId)
    }
  }

  // Sync all documents that have been modified since last sync
  async syncAll() {
    console.log('Starting full sync...')
    try {
      // Get all documents modified since last sync
      const remoteDocuments = await this.mongoStorage.find('documents', {
        updatedAt: { $gt: this.lastSyncTime.toISOString() }
      })

      console.log(`Found ${remoteDocuments.length} modified documents since last sync`)

      // Queue all modified documents for sync
      for (const doc of remoteDocuments) {
        if (doc._id) {
          this.queueForSync(doc._id)
        }
      }

      this.lastSyncTime = new Date()
    } catch (error) {
      console.error('Error during full sync:', error)
      throw error
    }
  }

  destroy() {
    this.stopPeriodicSync()
    this.syncQueue.clear()
    this.isInitialized = false
  }
} 