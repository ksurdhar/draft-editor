import axios from 'axios'
import * as Y from 'yjs'
import { Document } from '../lib/storage/types'
import { FileStorageAdapter } from '../lib/storage/file-storage'
import { YjsStorageAdapter } from '../lib/storage/yjs-storage'
import { documentStorage, folderStorage } from './storage-adapter'
import apiService from './api-service'
import DiffMatchPatch from 'diff-match-patch'
import { DocumentData } from '@typez/globals'

interface YjsContent {
  type: 'yjs'
  content: any
  state: any[]
}

interface ParagraphContent {
  type: 'text';
  text: string;
}

interface Paragraph {
  type: 'paragraph';
  content: ParagraphContent[];
}

interface DocumentContent {
  type: 'doc';
  content: Paragraph[];
}

// Update the content type in DocumentData
type ExtendedDocumentData = Omit<DocumentData, 'content'> & {
  content: DocumentContent
  updatedBy?: 'local' | 'remote'
}

function isYjsContent(content: any): content is YjsContent {
  return content && 
         typeof content === 'object' && 
         'type' in content && 
         content.type === 'yjs' &&
         'state' in content && 
         Array.isArray(content.state)
}

class SyncService {
  private static instance: SyncService
  private DOCUMENTS_COLLECTION = 'documents'
  private API_BASE_URL = process.env.NODE_ENV === 'test' 
    ? 'http://localhost:3000/api'
    : 'https://www.whetstone-writer.com/api'
  private ydocs: Map<string, Y.Doc> = new Map()
  private fileStorage: FileStorageAdapter
  private yjsStorage: YjsStorageAdapter

  private constructor() {
    this.fileStorage = folderStorage
    this.yjsStorage = documentStorage
  }

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

  private getYDoc(id: string): Y.Doc {
    let ydoc = this.ydocs.get(id)
    if (!ydoc) {
      ydoc = new Y.Doc()
      this.ydocs.set(id, ydoc)
    }
    return ydoc
  }

  private getYText(ydoc: Y.Doc): Y.Text {
    return ydoc.getText('content')
  }

  private parseContent(content: any): string {
    if (typeof content === 'string') {
      return content
    }
    return JSON.stringify(content)
  }

  mergeContent(content1: any, content2: any): DocumentContent {
    console.log('\n=== Merging Content ===')
    console.log('Content 1 type:', typeof content1)
    console.log('Content 2 type:', typeof content2)
    console.log('Raw Content 1:', content1)
    console.log('Raw Content 2:', content2)

    // Parse string inputs
    const parsed1 = typeof content1 === 'string' ? JSON.parse(content1) : content1
    const parsed2 = typeof content2 === 'string' ? JSON.parse(content2) : content2

    console.log('\nParsed contents:')
    console.log('Parsed Content 1:', JSON.stringify(parsed1, null, 2))
    console.log('Parsed Content 2:', JSON.stringify(parsed2, null, 2))

    // Validate document types
    if (parsed1.type !== 'doc' || !Array.isArray(parsed1.content)) {
      console.log('\nInvalid doc type, returning second content')
      return parsed2 as DocumentContent
    }
    if (parsed2.type !== 'doc' || !Array.isArray(parsed2.content)) {
      return parsed1 as DocumentContent
    }

    // Create merged result with initial structure
    const mergedResult: DocumentContent = {
      type: 'doc',
      content: []
    }

    // Initialize diff-match-patch
    const dmp = new DiffMatchPatch()

    // Create a map of text content to paragraph structure
    const paragraphMap = new Map<string, Paragraph>()

    // Add all paragraphs from both documents to the map
    parsed1.content.forEach((p: Paragraph) => {
      const text = this.paragraphToText(p)
      paragraphMap.set(text, p)
    })
    parsed2.content.forEach((p: Paragraph) => {
      const text = this.paragraphToText(p)
      paragraphMap.set(text, p)
    })

    // Get text versions of both documents
    const text1 = this.paragraphsToText(parsed1.content)
    const text2 = this.paragraphsToText(parsed2.content)

    // Compute diffs
    const diffs = dmp.diff_main(text1, text2)
    dmp.diff_cleanupSemantic(diffs)

    // Process diffs to reconstruct paragraphs
    const seenTexts = new Set<string>()
    
    // First, add the initial content from the first document if it exists
    if (parsed1.content.length > 0) {
      const initialText = this.paragraphToText(parsed1.content[0])
      mergedResult.content.push(parsed1.content[0])
      seenTexts.add(initialText)
    }

    // Then add remaining content from first document
    for (let i = 1; i < parsed1.content.length; i++) {
      const text = this.paragraphToText(parsed1.content[i])
      if (!seenTexts.has(text)) {
        mergedResult.content.push(parsed1.content[i])
        seenTexts.add(text)
      }
    }

    // Finally add content from second document
    parsed2.content.forEach((p: Paragraph) => {
      const text = this.paragraphToText(p)
      if (!seenTexts.has(text)) {
        mergedResult.content.push(p)
        seenTexts.add(text)
      }
    })

    console.log('\nMerged result:', JSON.stringify(mergedResult, null, 2))
    return mergedResult
  }

  private paragraphToText(paragraph: Paragraph): string {
    return paragraph.content.map(c => c.text).join('')
  }

  private paragraphsToText(paragraphs: Paragraph[]): string {
    return paragraphs.map(p => this.paragraphToText(p) + '\n').join('')
  }

  private isDuplicateParagraph(existingContent: DocumentContent['content'], newParagraph: DocumentContent['content'][0]): boolean {
    return existingContent.some((existing: DocumentContent['content'][0]) => 
      JSON.stringify(existing) === JSON.stringify(newParagraph)
    )
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
      
      // Initialize YJS document
      const ydoc = this.getYDoc(remoteDoc._id)
      const ytext = this.getYText(ydoc)
      
      // Set initial content
      const content = this.parseContent(doc.content)
      ytext.delete(0, ytext.length)
      ytext.insert(0, content)
      
      // Get the state vector and updates
      const state = Y.encodeStateVector(ydoc)
      const update = Y.encodeStateAsUpdate(ydoc)
      
      // Save locally with YJS content structure
      const localDoc = await documentStorage.create(this.DOCUMENTS_COLLECTION, {
        ...doc,
        _id: remoteDoc._id,
        lastUpdated: Date.now(),
        content: {
          type: 'yjs',
          content: content,
          state: Array.from(update),
          stateVector: Array.from(state)
        },
        updatedBy: 'local'
      } as any)

      const mappedDoc = this.mapToDocumentData(localDoc)
      if (!mappedDoc) throw new Error('Failed to create document')
      
      return {
        ...mappedDoc,
        content: doc.content || ''
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
          
          if (isYjsContent(content)) {
            console.log('Found YJS wrapper, extracting content')
            // Initialize YJS document if needed
            const ydoc = this.getYDoc(doc._id)
            const ytext = this.getYText(ydoc)
            
            // Apply stored state if it exists
            if (content.state) {
              Y.applyUpdate(ydoc, new Uint8Array(content.state))
            }
            
            // Get the content
            content = ytext.toString()
            try {
              content = JSON.parse(content)
              console.log('Parsed YJS content:', content)
            } catch (e) {
              console.log('Content is not JSON, using as is')
            }
          }
        } catch (e) {
          console.log('Failed to parse string content, using as is')
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

  private async createLocalDocument(doc: DocumentData) {
    console.log('\n=== Creating new document ===')
    console.log('Document ID:', doc._id)
    console.log('Document title:', doc.title)
    console.log('Content type:', typeof doc.content)
    
    // Initialize YJS document
    const ydoc = this.getYDoc(doc._id)
    const ytext = this.getYText(ydoc)
    
    // Set initial content
    const content = this.parseContent(doc.content)
    ytext.delete(0, ytext.length)
    ytext.insert(0, content)
    
    // Get the state vector and updates
    const state = Y.encodeStateVector(ydoc)
    const update = Y.encodeStateAsUpdate(ydoc)
    
    await documentStorage.create(this.DOCUMENTS_COLLECTION, {
      ...doc,
      content: {
        type: 'yjs',
        content: content,
        state: Array.from(update),
        stateVector: Array.from(state)
      },
      updatedBy: 'remote'
    } as any)
  }

  private async parseDocumentContent(content: any): Promise<any> {
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content)
        if (isYjsContent(content)) {
          content = JSON.parse(content.content)
        }
      } catch (e) {
        console.log('Failed to parse content:', e)
      }
    }
    return content
  }

  private async updateLocalDocument(remoteDoc: DocumentData, localDoc: DocumentData) {
    console.log('\n=== Checking document for updates ===')
    console.log('Document ID:', remoteDoc._id)
    console.log('Document title:', remoteDoc.title)
    console.log('Local lastUpdated:', localDoc.lastUpdated)
    console.log('Remote lastUpdated:', remoteDoc.lastUpdated)
    console.log('Local updatedBy:', (localDoc as any).updatedBy)

    // Get local and remote content
    const localContent = await this.parseDocumentContent(localDoc.content)
    const remoteContent = await this.parseDocumentContent(remoteDoc.content)

    console.log('Local content:', JSON.stringify(localContent, null, 2))
    console.log('Remote content:', JSON.stringify(remoteContent, null, 2))

    // Check if we need to merge changes
    const localUpdatedBy = (localDoc as any).updatedBy
    const hasLocalChanges = localUpdatedBy === 'local'
    const hasNewerRemoteChanges = remoteDoc.lastUpdated > localDoc.lastUpdated

    // Merge changes if either:
    // 1. We have local changes (regardless of timestamps)
    // 2. We have newer remote changes
    if (hasLocalChanges || hasNewerRemoteChanges) {
      console.log('Merging changes - Local changes:', hasLocalChanges, 'Remote changes:', hasNewerRemoteChanges)
      await this.mergeAndUpdateDocument(remoteDoc, localDoc, localContent, remoteContent)
    } else {
      console.log('No changes needed')
    }
  }

  private async mergeAndUpdateDocument(remoteDoc: DocumentData, localDoc: DocumentData, localContent: any, remoteContent: any) {
    console.log('Merging local and remote changes')
    const finalContent = this.mergeContent(localContent, remoteContent)

    // Initialize YJS document
    const ydoc = this.getYDoc(remoteDoc._id)
    const ytext = this.getYText(ydoc)
    
    // Set merged content
    const contentStr = this.parseContent(finalContent)
    ytext.delete(0, ytext.length)
    ytext.insert(0, contentStr)
    
    // Get the state vector and updates
    const state = Y.encodeStateVector(ydoc)
    const update = Y.encodeStateAsUpdate(ydoc)
    
    // Update local document with merged content
    await documentStorage.update(this.DOCUMENTS_COLLECTION, remoteDoc._id, {
      ...remoteDoc,
      content: {
        type: 'yjs',
        content: contentStr,
        state: Array.from(update),
        stateVector: Array.from(state)
      },
      lastUpdated: Math.max(localDoc.lastUpdated, remoteDoc.lastUpdated),
      updatedBy: 'local'  // Keep it as local since we have merged changes
    } as any)
    
    console.log('Document updated with merged content')
  }

  async syncRemoteToLocal() {
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
        await this.createLocalDocument(doc)
      }

      // Update existing documents if needed
      for (const remoteDoc of docsToUpdate) {
        const localDoc = localDocsMap.get(remoteDoc._id)
        if (!localDoc) continue
        await this.updateLocalDocument(remoteDoc, localDoc)
      }

      console.log('Remote to local sync completed')
    } catch (error) {
      console.error('Error syncing remote to local:', error)
      throw error
    }
  }
}

export default SyncService.getInstance()

