import { DocumentData } from '@typez/globals'
import { documentStorage } from './storage-adapter'
import apiService from './api-service'
import axios from 'axios'

class SyncService {
  private static instance: SyncService
  private DOCUMENTS_COLLECTION = 'documents'
  private API_BASE_URL = process.env.NODE_ENV === 'test' 
    ? 'http://localhost:3000/api'
    : 'https://www.whetstone-writer.com/api'

  private constructor() {}

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService()
    }
    return SyncService.instance
  }

  private mapToDocumentData(doc: any): DocumentData | null {
    if (!doc) return null
    return {
      id: doc._id,
      _id: doc._id,
      title: doc.title || '',
      content: doc.content || '',
      comments: doc.comments || [],
      lastUpdated: doc.lastUpdated || Date.now(),
      userId: doc.userId || '',
      folderIndex: doc.folderIndex || 0,
      parentId: doc.parentId || 'root'
    }
  }

  async saveLocalDocument(doc: Partial<DocumentData>): Promise<DocumentData> {
    try {
      // Clear any existing documents in test mode
      if (process.env.NODE_ENV === 'test') {
        await documentStorage.delete(this.DOCUMENTS_COLLECTION, {})
      }

      const result = await documentStorage.create(this.DOCUMENTS_COLLECTION, doc as any)
      const mappedDoc = this.mapToDocumentData(result)
      if (!mappedDoc) throw new Error('Failed to create document')
      return mappedDoc
    } catch (error) {
      console.error('Error saving local document:', error)
      throw error
    }
  }

  async saveDocument(doc: Partial<DocumentData>): Promise<DocumentData> {
    try {
      // First save remotely to get an ID and establish the document
      const remoteDoc = await this.uploadDocument(doc as DocumentData)
      
      // Then save locally with YJS content
      const localDoc = await documentStorage.create(this.DOCUMENTS_COLLECTION, {
        ...doc,
        _id: remoteDoc._id,
        lastUpdated: Date.now(),
        content: {
          type: 'yjs',
          content: doc.content || '', // Original content for YJS initialization
          state: [] // Initial empty state, YJS adapter will handle serialization
        },
        updatedBy: 'local' // Mark as locally updated
      } as any)

      const mappedDoc = this.mapToDocumentData(localDoc)
      if (!mappedDoc) throw new Error('Failed to create document')
      
      // Return the document with readable content
      return {
        ...mappedDoc,
        content: typeof localDoc.content === 'string' ? localDoc.content : 
                typeof localDoc.content === 'object' && localDoc.content.content ? 
                localDoc.content.content : JSON.stringify(localDoc.content)
      }
    } catch (error) {
      console.error('Error saving document:', error)
      throw error
    }
  }

  async getLocalDocument(id: string): Promise<DocumentData | null> {
    try {
      const doc = await documentStorage.findById(this.DOCUMENTS_COLLECTION, id)
      if (!doc) return null

      // Handle YJS content
      let content: any = doc.content
      if (typeof content === 'string') {
        try {
          const parsedContent = JSON.parse(content)
          if (parsedContent.type === 'yjs') {
            content = parsedContent.content
          }
        } catch (e) {
          // If parsing fails, use the content as is
        }
      }

      return {
        ...this.mapToDocumentData(doc)!,
        content: typeof content === 'string' ? content : JSON.stringify(content)
      }
    } catch (error) {
      console.error('Error getting local document:', error)
      throw error
    }
  }

  async getAllLocalDocuments(): Promise<DocumentData[]> {
    try {
      const docs = await documentStorage.find(this.DOCUMENTS_COLLECTION)
      return docs.map(doc => this.mapToDocumentData(doc)).filter((doc): doc is DocumentData => doc !== null)
    } catch (error) {
      console.error('Error getting all local documents:', error)
      throw error
    }
  }

  // New API interaction methods
  async getRemoteDocuments(): Promise<DocumentData[]> {
    try {
      const response = await apiService.get('/documents')
      if (!Array.isArray(response)) {
        console.error('Unexpected response format:', response)
        return []
      }
      return response.map(doc => this.mapToDocumentData(doc)).filter((doc): doc is DocumentData => doc !== null)
    } catch (error) {
      console.error('Error fetching remote documents:', error)
      throw error
    }
  }

  async getRemoteDocument(id: string): Promise<DocumentData | null> {
    try {
      const response = await apiService.get(`/documents/${id}`)
      if (!response) return null

      // Handle YJS content
      let content: any = response.content
      if (typeof content === 'string') {
        try {
          const parsedContent = JSON.parse(content)
          if (parsedContent.type === 'yjs') {
            content = parsedContent.content
          }
        } catch (e) {
          // If parsing fails, use the content as is
        }
      }

      return {
        ...this.mapToDocumentData(response)!,
        content: typeof content === 'string' ? content : JSON.stringify(content)
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null
      }
      console.error('Error fetching remote document:', error)
      throw error
    }
  }

  async uploadDocument(doc: DocumentData): Promise<DocumentData> {
    try {
      let response
      if (doc._id) {
        // Update existing document
        response = await apiService.patch(`/documents/${doc._id}`, doc)
      } else {
        // Create new document
        response = await apiService.post('/documents', doc)
      }
      const mappedDoc = this.mapToDocumentData(response)
      if (!mappedDoc) throw new Error('Failed to upload document')
      return mappedDoc
    } catch (error) {
      console.error('Error uploading document:', error)
      throw error
    }
  }

  async bulkFetchRemoteDocuments(ids: string[]): Promise<DocumentData[]> {
    try {
      const response = await apiService.post('/documents/bulk-fetch', { ids })
      if (!Array.isArray(response)) {
        console.error('Unexpected response format:', response)
        return []
      }
      return response.map(doc => this.mapToDocumentData(doc)).filter((doc): doc is DocumentData => doc !== null)
    } catch (error) {
      console.error('Error bulk fetching remote documents:', error)
      throw error
    }
  }
}

export default SyncService.getInstance() 