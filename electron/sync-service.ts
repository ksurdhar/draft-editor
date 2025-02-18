import * as Y from 'yjs'
import { MongoStorageAdapter } from '../lib/storage/mongo-storage'
import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import { Document, JsonDocument } from '../lib/storage/types'

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

  constructor(localStorage: YjsStorageAdapter, mongoStorage: MongoStorageAdapter) {
    this.localStorage = localStorage
    this.mongoStorage = mongoStorage
    this.syncQueue = new Set()
    this.isSyncing = false
    this.lastSyncTime = new Date(0) // Start with epoch time
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
      for (const docId of this.syncQueue) {
        await this.syncDocument(docId)
        this.syncQueue.delete(docId)
      }
    } finally {
      this.isSyncing = false
    }
  }

  // Sync a single document
  private async syncDocument(documentId: string) {
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

      await Promise.all([
        this.localStorage.update('documents', documentId, { content: mergedContent }),
        this.mongoStorage.update('documents', documentId, { content: mergedContent })
      ])

    } catch (error) {
      console.error(`Error syncing document ${documentId}:`, error)
      // Re-queue for later retry
      this.syncQueue.add(documentId)
    }
  }

  // Sync all documents that have been modified since last sync
  async syncAll() {
    try {
      // Get all documents modified since last sync
      const remoteDocuments = await this.mongoStorage.find('documents', {
        updatedAt: { $gt: this.lastSyncTime.toISOString() }
      })

      // Queue all modified documents for sync
      for (const doc of remoteDocuments) {
        if (doc._id) {
          this.queueForSync(doc._id)
        }
      }

      this.lastSyncTime = new Date()
    } catch (error) {
      console.error('Error during full sync:', error)
    }
  }
} 