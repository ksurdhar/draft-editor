import { DocumentData, DocContent, SerializedContent, DeserializedContent } from '../types/globals'
import { documentStorage } from './storage-adapter'
import apiService from './api-service'
import axios from 'axios'
import * as Y from 'yjs'
import { Schema } from 'prosemirror-model'
import { yDocToProsemirror, prosemirrorToYDoc } from 'y-prosemirror'
import { applyTiptapChangesToSerializedYDoc } from '../tests/utils/y-doc-helpers'

// Define schema for Tiptap/ProseMirror operations
const schema = new Schema({
  nodes: {
    doc: {
      content: 'paragraph+'
    },
    paragraph: {
      content: 'text*',
      toDOM() { return ['p', 0] },
      parseDOM: [{ tag: 'p' }]
    },
    text: {
      group: 'inline',
      inline: true
    }
  }
})

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
    
    // Handle content consistently
    let content = doc.content
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content)
      } catch (e) {
        // If parsing fails, use the content as is
      }
    }

    return {
      id: doc._id,
      _id: doc._id,
      title: doc.title || '',
      content: content || '',
      comments: doc.comments || [],
      lastUpdated: doc.lastUpdated || Date.now(),
      userId: doc.userId || '',
      folderIndex: doc.folderIndex || 0,
      parentId: doc.parentId || 'root',
      updatedBy: doc.updatedBy
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
      
      // Prepare the default content structure
      const defaultContent: DocContent = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: '' }]
        }]
      }

      // Convert Prosemirror content to YJS format
      const ydoc = new Y.Doc()
      const docContent = typeof doc.content === 'string' ? defaultContent : (doc.content as DocContent || defaultContent)
      const state = applyTiptapChangesToSerializedYDoc(
        Y.encodeStateAsUpdate(ydoc),
        docContent,
        schema
      )
      Y.applyUpdate(ydoc, state)

      // Convert to serialized content structure for storage
      const serializedContent: SerializedContent = {
        type: 'yjs',
        content: Array.from(Y.encodeStateAsUpdate(ydoc))
      }

      // Then save locally with serialized content
      const localDoc = await documentStorage.create(this.DOCUMENTS_COLLECTION, {
        ...doc,
        _id: remoteDoc._id,
        lastUpdated: Date.now(),
        content: serializedContent,
        updatedBy: 'local'
      } as any)

      // Return the document with deserialized content
      return {
        ...this.mapToDocumentData(localDoc)!,
        content: docContent
      }
    } catch (error) {
      console.error('Error saving document:', error)
      throw error
    }
  }

  async getLocalDocument(id: string): Promise<DocumentData | null> {
    const doc = await documentStorage.findById('documents', id)
    if (!doc) {
      return null
    }

    // If content is YJS format, convert it to Prosemirror format
    if (doc.content && typeof doc.content === 'object' && 'type' in doc.content && doc.content.type === 'yjs' && 'content' in doc.content && Array.isArray(doc.content.content)) {
      const ydoc = new Y.Doc()
      Y.applyUpdate(ydoc, new Uint8Array(doc.content.content))
      const prosemirrorDoc = yDocToProsemirror(schema, ydoc)
      const docContent: DocContent = prosemirrorDoc.toJSON()
      return {
        ...this.mapToDocumentData(doc)!,
        content: docContent
      }
    }

    return this.mapToDocumentData(doc)
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
          content = JSON.parse(content)
        } catch (e) {
          // If parsing fails, use the content as is
        }
      }

      // If content is YJS format, convert it to Prosemirror format
      if (content && typeof content === 'object' && 'type' in content && content.type === 'yjs' && 'content' in content && Array.isArray(content.content)) {
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(content.content))
        const prosemirrorDoc = yDocToProsemirror(schema, ydoc)
        const docContent: DocContent = prosemirrorDoc.toJSON()
        return {
          ...this.mapToDocumentData(response)!,
          content: docContent
        }
      }

      return {
        ...this.mapToDocumentData(response)!,
        content
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
        // Create new document with YJS content structure
        const ydoc = new Y.Doc()
        
        // Convert Prosemirror content to YJS format
        const docContent = typeof doc.content === 'string' ? 
          { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: doc.content }] }] } :
          (doc.content as DocContent)

        const state = applyTiptapChangesToSerializedYDoc(
          Y.encodeStateAsUpdate(ydoc),
          docContent,
          schema
        )
        Y.applyUpdate(ydoc, state)

        const docWithYjsContent = {
          ...doc,
          content: {
            type: 'yjs',
            content: Array.from(Y.encodeStateAsUpdate(ydoc))
          }
        }
        response = await apiService.post('/documents', docWithYjsContent)
      }
      const mappedDoc = this.mapToDocumentData(response)
      if (!mappedDoc) throw new Error('Failed to upload document')

      // Convert YJS content back to Prosemirror format
      if (mappedDoc.content && typeof mappedDoc.content === 'object' && 'type' in mappedDoc.content && mappedDoc.content.type === 'yjs' && 'content' in mappedDoc.content && Array.isArray(mappedDoc.content.content)) {
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(mappedDoc.content.content))
        const prosemirrorDoc = yDocToProsemirror(schema, ydoc)
        const docContent: DocContent = prosemirrorDoc.toJSON()
        return {
          ...mappedDoc,
          content: docContent
        }
      }

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