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
      
      // Transform content to string if it's an object
      const contentString = typeof doc.content === 'string' ? 
        doc.content : 
        JSON.stringify(doc.content)
      
      // Then save locally with YJS content structure
      const localDoc = await documentStorage.create(this.DOCUMENTS_COLLECTION, {
        ...doc,
        _id: remoteDoc._id,
        lastUpdated: Date.now(),
        content: {
          type: 'yjs',
          content: contentString,
          state: []
        },
        updatedBy: 'local'
      } as any)

      const mappedDoc = this.mapToDocumentData(localDoc)
      if (!mappedDoc) throw new Error('Failed to create document')
      
      // Return the document with the original content format
      return {
        ...mappedDoc,
        content: doc.content || ''  // Preserve original content format but handle undefined
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

      console.log('\n=== getLocalDocument ===')
      console.log('Raw document from storage:', doc)
      console.log('Raw content type:', typeof doc.content)
      console.log('Raw content:', doc.content)

      // Handle YJS content
      let content: any = doc.content
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content)
          console.log('Parsed string content:', content)
          
          // If it's a YJS wrapper, extract the actual content
          if (content.type === 'yjs') {
            console.log('Found YJS wrapper, extracting content')
            content = content.content
            // If the content is still a string, try to parse it
            if (typeof content === 'string') {
              try {
                content = JSON.parse(content)
                console.log('Parsed YJS content:', content)
              } catch (e) {
                console.log('Failed to parse YJS content string, using as is')
              }
            }
          }
        } catch (e) {
          console.log('Failed to parse string content, using as is')
        }
      } else if (typeof content === 'object') {
        if (content.type === 'yjs') {
          console.log('Found YJS content object:', content)
          content = content.content
          // If the content is a string, try to parse it
          if (typeof content === 'string') {
            try {
              content = JSON.parse(content)
              console.log('Parsed YJS content:', content)
            } catch (e) {
              console.log('Failed to parse YJS content string, using as is')
            }
          }
        }
      }

      // Return the content in its original format
      const result = {
        ...this.mapToDocumentData(doc)!,
        content: typeof content === 'object' ? JSON.stringify(content) : content
      }
      console.log('Final document to return:', result)
      console.log('Final content type:', typeof result.content)
      return result
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

  async syncRemoteToLocal(): Promise<void> {
    try {
      console.log('\n=== Starting remote to local sync ===')
      
      // Get all remote documents
      const remoteDocs = await this.getRemoteDocuments()
      console.log(`Found ${remoteDocs.length} remote documents`)

      // Get all local documents
      const localDocs = await this.getAllLocalDocuments()
      console.log(`Found ${localDocs.length} local documents`)

      // Create a map of local documents for faster lookup
      const localDocsMap = new Map(localDocs.map(doc => [doc._id, doc]))

      // Separate documents into new and existing
      const docsToCreate = remoteDocs.filter(doc => !localDocsMap.has(doc._id))
      const docsToUpdate = remoteDocs.filter(doc => localDocsMap.has(doc._id))

      console.log(`Found ${docsToCreate.length} documents to create`)
      console.log(`Found ${docsToUpdate.length} documents to check for updates`)

      // Create missing documents locally
      for (const doc of docsToCreate) {
        console.log('\n=== Creating new document ===')
        console.log('Document ID:', doc._id)
        console.log('Document title:', doc.title)
        console.log('Content type:', typeof doc.content)
        
        await documentStorage.create(this.DOCUMENTS_COLLECTION, {
          ...doc,
          content: doc.content,
          updatedBy: 'remote'
        } as any)
      }

      // Update existing documents if needed
      for (const remoteDoc of docsToUpdate) {
        const localDoc = localDocsMap.get(remoteDoc._id)
        if (!localDoc) continue // TypeScript safety check

        console.log('\n=== Checking document for updates ===')
        console.log('Document ID:', remoteDoc._id)
        console.log('Document title:', remoteDoc.title)
        console.log('Local lastUpdated:', localDoc.lastUpdated)
        console.log('Remote lastUpdated:', remoteDoc.lastUpdated)
        console.log('Local updatedBy:', (localDoc as any).updatedBy)

        // Update if:
        // 1. Remote is newer OR
        // 2. Local was last updated by remote (meaning it's safe to update)
        if (remoteDoc.lastUpdated > localDoc.lastUpdated || 
            (localDoc as any).updatedBy === 'remote') {
          console.log('Updating local document with remote changes')
          await documentStorage.update(this.DOCUMENTS_COLLECTION, remoteDoc._id, {
            ...remoteDoc,
            content: remoteDoc.content,
            updatedBy: 'remote'
          } as any)
        } else {
          console.log('Local document is newer or was updated locally, skipping update')
        }
      }

      console.log('Remote to local sync completed')
    } catch (error) {
      console.error('Error during remote to local sync:', error)
      throw error
    }
  }
}

export default SyncService.getInstance()
