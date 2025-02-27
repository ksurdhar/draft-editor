import { DocumentData, DocContent, SerializedContent } from '../types/globals'
import { documentStorage } from './storage-adapter'
import apiService from './api-service'
import axios from 'axios'
import * as Y from 'yjs'
import { Schema } from 'prosemirror-model'
import { yDocToProsemirror } from 'y-prosemirror'
import { 
  applyTiptapChangesToSerializedYDoc,
} from '../tests/utils/y-doc-helpers'
import DiffMatchPatch from 'diff-match-patch'

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
        type: 'yjs' as const,
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

  /**
   * Extract text content from paragraphs in a document
   */
  private extractParagraphTexts(content: DocContent): string[] {
    return content.content.map((p: any) => p.content?.[0]?.text || '')
  }
  
  /**
   * Retrieves the document and extracts its content
   */
  private async retrieveDocumentAndContent(docId: string): Promise<{
    doc: DocumentData,
    initialContent: DocContent,
    originalParagraphs: string[]
  }> {
    const doc = await this.getLocalDocument(docId)
    if (!doc) {
      throw new Error(`Document not found: ${docId}`)
    }

    // Extract initial content
    const initialContent = typeof doc.content === 'string' ? 
      { type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: doc.content }] }] } :
      (doc.content as DocContent)
    
    // Extract paragraphs from original content
    const originalParagraphs = this.extractParagraphTexts(initialContent)
    console.log('Original paragraphs:', originalParagraphs)
    
    return { doc, initialContent, originalParagraphs }
  }

  /**
   * Detects paragraphs that were intentionally deleted
   */
  private detectDeletedParagraphs(
    originalParagraphs: string[],
    changedParagraphs: string[][]
  ): { 
    deletedParagraphs: Set<number>,
    deletedVersionParas: Map<string, boolean>
  } {
    const deletedParagraphs = new Set<number>()
    const deletedVersionParas = new Map<string, boolean>()
    
    // First version paragraphs (e.g., mobile version that deleted a paragraph)
    const version0 = changedParagraphs[0]
    
    // For each original paragraph
    for (let origIdx = 0; origIdx < originalParagraphs.length; origIdx++) {
      this.checkIfParagraphWasDeleted(
        origIdx,
        originalParagraphs[origIdx],
        version0,
        changedParagraphs,
        deletedParagraphs,
        deletedVersionParas
      )
    }
    
    console.log('\nDeleted paragraphs:', Array.from(deletedParagraphs))
    console.log('Paragraphs in versions that match deleted originals:', Array.from(deletedVersionParas.entries()))
    
    return { deletedParagraphs, deletedVersionParas }
  }

  /**
   * Checks if a specific paragraph was deleted
   */
  private checkIfParagraphWasDeleted(
    origIdx: number,
    origPara: string,
    version0: string[],
    changedParagraphs: string[][],
    deletedParagraphs: Set<number>,
    deletedVersionParas: Map<string, boolean>
  ): void {
    console.log(`\nChecking if paragraph ${origIdx} was deleted: "${origPara.substring(0, 30)}..."`)
    
    // Check if this paragraph exists in version 0
    const { foundInVersion, bestMatchScore } = this.findParagraphInVersion(origPara, version0, 0.7)
    
    // If paragraph doesn't exist in version 0, check if it was modified in other versions
    if (!foundInVersion) {
      console.log(`  Not found in version 0. Best match score: ${bestMatchScore.toFixed(2)}`)
      this.checkIfDeletedButModifiedElsewhere(
        origIdx,
        origPara,
        changedParagraphs,
        deletedParagraphs,
        deletedVersionParas
      )
    }
  }

  /**
   * Finds a paragraph in a specific version
   */
  private findParagraphInVersion(
    origPara: string,
    versionParagraphs: string[],
    similarityThreshold: number
  ): { foundInVersion: boolean, bestMatchScore: number, bestMatchIdx: number } {
    let foundInVersion = false
    let bestMatchScore = 0
    let bestMatchIdx = -1
    
    for (let paraIdx = 0; paraIdx < versionParagraphs.length; paraIdx++) {
      const versionPara = versionParagraphs[paraIdx]
      const similarity = this.calculateSimilarity(origPara, versionPara)
      
      if (similarity > bestMatchScore) {
        bestMatchScore = similarity
        bestMatchIdx = paraIdx
      }
      
      if (similarity > similarityThreshold) {
        foundInVersion = true
        console.log(`  Found in version with similarity ${similarity.toFixed(2)}`)
        break
      }
    }
    
    return { foundInVersion, bestMatchScore, bestMatchIdx }
  }

  /**
   * Checks if a paragraph was deleted in one version but modified in others
   */
  private checkIfDeletedButModifiedElsewhere(
    origIdx: number,
    origPara: string,
    changedParagraphs: string[][],
    deletedParagraphs: Set<number>,
    deletedVersionParas: Map<string, boolean>
  ): void {
    let significantlyModified = false
    
    // Check other versions (e.g., desktop version)
    for (let versionIdx = 1; versionIdx < changedParagraphs.length; versionIdx++) {
      const versionParagraphs = changedParagraphs[versionIdx]
      
      let bestMatchParaIdx = -1
      let bestMatchScore = 0
      
      for (let paraIdx = 0; paraIdx < versionParagraphs.length; paraIdx++) {
        const versionPara = versionParagraphs[paraIdx]
        const similarity = this.calculateSimilarity(origPara, versionPara)
        console.log(`  Checking version ${versionIdx}, para ${paraIdx}: similarity ${similarity.toFixed(2)} with "${versionPara.substring(0, 30)}..."`)
        
        if (similarity > bestMatchScore) {
          bestMatchScore = similarity
          bestMatchParaIdx = paraIdx
        }
        
        // If paragraph exists in this version with high similarity, it wasn't modified
        if (similarity > 0.9) {
          console.log(`  Found almost identical in version ${versionIdx}, paragraph ${paraIdx}`)
          // Mark this paragraph in this version as corresponding to a deleted paragraph
          deletedVersionParas.set(`${versionIdx}-${paraIdx}`, true)
          console.log(`  Marked version ${versionIdx}, paragraph ${paraIdx} as matching a deleted paragraph`)
          // It exists unchanged in another version, but was deleted in version 0
          // This is a true deletion
          console.log(`  ✓ MARKING FOR DELETION - identical in other version but missing in version 0`)
          deletedParagraphs.add(origIdx)
          break
        }
        // If paragraph exists but was significantly modified
        else if (similarity > 0.5) {
          console.log(`  Found modified in version ${versionIdx}, paragraph ${paraIdx}`)
          significantlyModified = true
          break
        }
      }
      
      if (bestMatchParaIdx !== -1 && !significantlyModified && bestMatchScore > 0.9) {
        deletedVersionParas.set(`${versionIdx}-${bestMatchParaIdx}`, true)
        console.log(`  Marked best match: version ${versionIdx}, paragraph ${bestMatchParaIdx} as matching a deleted paragraph`)
      }
      
      if (significantlyModified) {
        break
      }
    }
    
    // If not significantly modified in any version, mark as deleted
    if (!significantlyModified && !deletedParagraphs.has(origIdx)) {
      console.log(`  ✓ MARKING FOR DELETION - not found in version 0 and not modified elsewhere`)
      deletedParagraphs.add(origIdx)
    }
  }

  /**
   * Processes original paragraphs and merges with versions
   */
  private processOriginalParagraphs(
    originalParagraphs: string[],
    changedParagraphs: string[][],
    deletedParagraphs: Set<number>
  ): {
    result: string[],
    processed: Set<string>,
    originalParaMapping: Map<string, number>
  } {
    const result: string[] = []
    const processed = new Set<string>()
    const originalParaMapping = new Map<string, number>()
    
    for (let origIdx = 0; origIdx < originalParagraphs.length; origIdx++) {
      if (deletedParagraphs.has(origIdx)) {
        console.log(`Skipping deleted paragraph ${origIdx}: "${originalParagraphs[origIdx].substring(0, 30)}..."`)
        continue
      }
      
      const { mergedPara, processedKeys, mappings } = this.mergeParagraphVersions(
        origIdx,
        originalParagraphs[origIdx],
        changedParagraphs,
        result.length
      )
      
      result.push(mergedPara)
      
      // Add all processed keys
      for (const key of processedKeys) {
        processed.add(key)
      }
      
      // Add all mappings
      for (const [key, pos] of mappings) {
        originalParaMapping.set(key, pos)
      }
    }
    
    return { result, processed, originalParaMapping }
  }

  /**
   * Merges all versions of a single paragraph
   */
  private mergeParagraphVersions(
    origIdx: number,
    origPara: string,
    changedParagraphs: string[][],
    resultIndex: number
  ): {
    mergedPara: string,
    processedKeys: Set<string>,
    mappings: Map<string, number>
  } {
    console.log(`Processing original paragraph ${origIdx}: "${origPara.substring(0, 30)}..."`)
    
    // Find all versions of this paragraph
    const versions = [origPara]
    const processedKeys = new Set<string>()
    const mappings = new Map<string, number>()
    
    for (let versionIdx = 0; versionIdx < changedParagraphs.length; versionIdx++) {
      const versionParagraphs = changedParagraphs[versionIdx]
      
      // Find best match in this version
      let bestMatchIdx = -1
      let bestMatchScore = 0.1 // Minimum similarity threshold
      
      for (let paraIdx = 0; paraIdx < versionParagraphs.length; paraIdx++) {
        const versionPara = versionParagraphs[paraIdx]
        const similarity = this.calculateSimilarity(origPara, versionPara)
        
        if (similarity > bestMatchScore) {
          bestMatchScore = similarity
          bestMatchIdx = paraIdx
        }
      }
      
      if (bestMatchIdx !== -1) {
        const paraKey = `${versionIdx}-${bestMatchIdx}`
        const matchedPara = versionParagraphs[bestMatchIdx]
        versions.push(matchedPara)
        processedKeys.add(paraKey)
        console.log(`  Added match from version ${versionIdx}, paragraph ${bestMatchIdx} (similarity: ${bestMatchScore.toFixed(2)})`)
        
        // Store the mapping for this version's paragraph to its result index
        mappings.set(paraKey, resultIndex)
      }
    }
    
    // Merge all versions of this paragraph
    const mergedPara = this.mergeTextEdits(origPara, versions)
    console.log(`  → Added merged paragraph: "${mergedPara.substring(0, 30)}..."`)
    
    return { mergedPara, processedKeys, mappings }
  }

  /**
   * Processes new paragraphs from all versions
   */
  private processNewParagraphs(
    result: string[],
    processed: Set<string>,
    changedParagraphs: string[][],
    originalParaMapping: Map<string, number>,
    deletedVersionParas: Map<string, boolean>
  ): string[] {
    const resultWithNew = [...result]
    
    for (let versionIdx = 0; versionIdx < changedParagraphs.length; versionIdx++) {
      this.insertNewParagraphsFromVersion(
        versionIdx,
        changedParagraphs[versionIdx],
        resultWithNew,
        processed,
        originalParaMapping,
        deletedVersionParas
      )
    }
    
    return resultWithNew
  }

  /**
   * Inserts new paragraphs from a specific version
   */
  private insertNewParagraphsFromVersion(
    versionIdx: number,
    versionParagraphs: string[],
    result: string[],
    processed: Set<string>,
    originalParaMapping: Map<string, number>,
    deletedVersionParas: Map<string, boolean>
  ): void {
    const newParagraphs = this.findNewParagraphsInVersion(
      versionIdx,
      versionParagraphs,
      processed,
      originalParaMapping,
      deletedVersionParas
    )
    
    // Sort by context position
    this.sortNewParagraphsByContext(newParagraphs)
    
    // Insert each paragraph
    for (const { paraIdx, text, prevMatchedIdx, nextMatchedIdx } of newParagraphs) {
      const insertPos = this.determineInsertPosition(
        prevMatchedIdx,
        nextMatchedIdx,
        result.length
      )
      
      console.log(`Adding unmatched paragraph from version ${versionIdx}: "${text.substring(0, 30)}..." at position ${insertPos}`)
      
      // Insert and update positions
      result.splice(insertPos, 0, text)
      processed.add(`${versionIdx}-${paraIdx}`)
      
      // Update mapping for paragraphs after this insertion
      this.updatePositionMappings(originalParaMapping, insertPos)
    }
  }

  /**
   * Finds new paragraphs in a specific version
   */
  private findNewParagraphsInVersion(
    versionIdx: number,
    versionParagraphs: string[],
    processed: Set<string>,
    originalParaMapping: Map<string, number>,
    deletedVersionParas: Map<string, boolean>
  ): Array<{
    paraIdx: number,
    text: string,
    prevMatchedIdx: number | null,
    nextMatchedIdx: number | null
  }> {
    const newParagraphs = []
    
    for (let paraIdx = 0; paraIdx < versionParagraphs.length; paraIdx++) {
      const paraKey = `${versionIdx}-${paraIdx}`
      
      // Skip if already processed or if it corresponds to a deleted paragraph
      if (processed.has(paraKey) || deletedVersionParas.get(paraKey)) {
        console.log(`Skipping paragraph ${paraKey} - already processed or matches a deleted paragraph`)
        continue
      }
      
      const para = versionParagraphs[paraIdx]
      
      // Find context paragraphs
      const { prevMatchedIdx, nextMatchedIdx } = this.findContextParagraphs(
        versionIdx,
        paraIdx,
        processed,
        originalParaMapping
      )
      
      newParagraphs.push({
        paraIdx,
        text: para,
        prevMatchedIdx,
        nextMatchedIdx
      })
    }
    
    return newParagraphs
  }

  /**
   * Finds the context paragraphs (before and after) for a new paragraph
   */
  private findContextParagraphs(
    versionIdx: number,
    paraIdx: number,
    processed: Set<string>,
    originalParaMapping: Map<string, number>
  ): {
    prevMatchedIdx: number | null,
    nextMatchedIdx: number | null
  } {
    let prevMatchedIdx = null
    let nextMatchedIdx = null
    
    // Look for previous processed paragraph
    for (let i = paraIdx - 1; i >= 0; i--) {
      const prevKey = `${versionIdx}-${i}`
      if (processed.has(prevKey)) {
        prevMatchedIdx = originalParaMapping.get(prevKey) ?? null
        break
      }
    }
    
    // Look for next processed paragraph
    for (let i = paraIdx + 1; i < Infinity; i++) {
      const nextKey = `${versionIdx}-${i}`
      if (processed.has(nextKey)) {
        nextMatchedIdx = originalParaMapping.get(nextKey) ?? null
        break
      }
      
      // Safety check - if we've looked too far ahead, stop
      if (i > paraIdx + 100) break
    }
    
    return { prevMatchedIdx, nextMatchedIdx }
  }

  /**
   * Sorts new paragraphs by their context to maintain relative ordering
   */
  private sortNewParagraphsByContext(newParagraphs: Array<{
    paraIdx: number,
    text: string,
    prevMatchedIdx: number | null,
    nextMatchedIdx: number | null
  }>): void {
    newParagraphs.sort((a, b) => {
      // If both have same prev index, sort by their original order
      if (a.prevMatchedIdx === b.prevMatchedIdx) {
        return a.paraIdx - b.paraIdx
      }
      
      // If one has no prev, put it at the beginning if next match exists
      if (a.prevMatchedIdx === null) return a.nextMatchedIdx !== null ? -1 : 1
      if (b.prevMatchedIdx === null) return b.nextMatchedIdx !== null ? 1 : -1
      
      // Otherwise sort by prev match index
      return a.prevMatchedIdx - b.prevMatchedIdx
    })
  }

  /**
   * Determines the best position to insert a new paragraph
   */
  private determineInsertPosition(
    prevMatchedIdx: number | null,
    nextMatchedIdx: number | null,
    resultLength: number
  ): number {
    let insertPos
    
    if (prevMatchedIdx !== null && nextMatchedIdx !== null) {
      // If we have both prev and next, insert between them
      insertPos = prevMatchedIdx + 1
    } else if (prevMatchedIdx !== null) {
      // If we only have prev, insert after it
      insertPos = prevMatchedIdx + 1
    } else if (nextMatchedIdx !== null) {
      // If we only have next, insert before it
      insertPos = nextMatchedIdx
    } else {
      // If we have neither, append to the end
      insertPos = resultLength
    }
    
    return insertPos
  }

  /**
   * Updates position mappings after inserting a paragraph
   */
  private updatePositionMappings(
    originalParaMapping: Map<string, number>,
    insertPos: number
  ): void {
    for (const [key, pos] of originalParaMapping.entries()) {
      if (pos >= insertPos) {
        originalParaMapping.set(key, pos + 1)
      }
    }
  }

  /**
   * Creates final document content from paragraph text array
   */
  private createFinalDocumentContent(
    mergedParagraphs: string[]  ): {
    finalContent: DocContent,
    serializedContent: SerializedContent
  } {
    console.log('Final result:', mergedParagraphs)
    
    // Construct the final document
    const finalContent = this.createFinalContent(mergedParagraphs)
    
    // Convert to YJS format for storage
    const ydoc = new Y.Doc()
    const state = applyTiptapChangesToSerializedYDoc(
      Y.encodeStateAsUpdate(ydoc),
      finalContent,
      schema
    )
    
    // Serialize for storage
    const serializedContent: SerializedContent = {
      type: 'yjs' as const,
      content: Array.from(state)
    }
    
    return { finalContent, serializedContent }
  }

  /**
   * Saves the document with updated content
   */
  private async saveUpdatedDocument(
    doc: DocumentData,
    serializedContent: SerializedContent,
    finalContent: DocContent
  ): Promise<DocumentData> {
    // Save the updated document
    const updatedDoc = await documentStorage.create(this.DOCUMENTS_COLLECTION, {
      ...doc,
      content: serializedContent,
      lastUpdated: Date.now(),
      updatedBy: 'local'
    } as any)
    
    return {
      ...this.mapToDocumentData(updatedDoc)!,
      content: finalContent
    }
  }

  /**
   * Main method to sync document changes
   */
  async syncDocumentChanges(docId: string, changes: DocContent[]): Promise<DocumentData> {
    try {
      // Step 1: Get the document and extract content
      const { doc, originalParagraphs } = await this.retrieveDocumentAndContent(docId)
      
      // Step 2: Extract paragraphs from the changed versions
      const changedParagraphs = changes.map(change => this.extractParagraphTexts(change))
      console.log('Changed paragraphs:')
      changedParagraphs.forEach((version, idx) => {
        console.log(`Version ${idx}:`, version)
      })
      
      // Step 3: Detect deleted paragraphs
      const { deletedParagraphs, deletedVersionParas } = this.detectDeletedParagraphs(
        originalParagraphs,
        changedParagraphs
      )
      
      // Step 4: Process original paragraphs
      const { result, processed, originalParaMapping } = this.processOriginalParagraphs(
        originalParagraphs,
        changedParagraphs,
        deletedParagraphs
      )
      
      // Step 5: Process new paragraphs
      const mergedParagraphs = this.processNewParagraphs(
        result,
        processed,
        changedParagraphs,
        originalParaMapping,
        deletedVersionParas
      )
      
      // Step 6: Create final document content
      const { finalContent, serializedContent } = this.createFinalDocumentContent(
        mergedParagraphs,
      )
      
      // Step 7: Save the updated document
      return await this.saveUpdatedDocument(doc, serializedContent, finalContent)
      
    } catch (error) {
      console.error('Error syncing document changes:', error)
      throw error
    }
  }

  /**
   * Calculate similarity between two strings
   * Returns a value between 0 (completely different) and 1 (identical)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // If either string is empty, return 0
    if (!str1 || !str2) return 0
    
    // Use the diff-match-patch library to calculate similarity
    const dmp = new DiffMatchPatch()
    const diffs = dmp.diff_main(str1, str2)
    
    // Count matching characters
    let matchingChars = 0
    
    for (const [op, text] of diffs) {
      if (op === 0) { // EQUAL
        matchingChars += text.length
      }
    }
    
    return matchingChars / Math.max(str1.length, str2.length)
  }

  /**
   * Merges multiple edits to the same text using a more sophisticated approach
   * that preserves changes from different users even when they edit different parts
   * of the same paragraph
   */
  private mergeTextEdits(original: string, edits: string[]): string {
    // Create an instance of the diff-match-patch library
    const dmp = new DiffMatchPatch()
    
    // If there's only one edit, return it directly
    if (edits.length === 1) {
      return edits[0]
    }
    
    // If we only have the original text, return it
    if (edits.length === 0) {
      return original
    }
    
    // For complex merges where different users edited different parts of the text,
    // we need a more sophisticated approach that combines all the changes
    
    // Step 1: Identify the changes each user made compared to the original
    const userChanges: Array<{insert: string, position: number}[]> = []
    
    for (const edit of edits) {
      if (edit === original) continue // Skip if the edit is the same as original
      
      // Compute the diff between original and this edit
      const diff = dmp.diff_main(original, edit)
      dmp.diff_cleanupSemantic(diff) // Clean up the diff for better results
      
      // Extract insertions and changes
      const changes: {insert: string, position: number}[] = []
      let position = 0
      
      for (const [op, text] of diff) {
        if (op === 0) { // EQUAL - text is unchanged
          position += text.length
        } else if (op === 1) { // INSERT - text was added
          changes.push({insert: text, position})
        } else if (op === -1) { // DELETE - text was removed
          // For deletions, we adjust the position
          position += text.length
        }
      }
      
      userChanges.push(changes)
    }
    
    // Step 2: Apply all the changes to the original text
    // We need to sort the changes by position (descending) to avoid position shifts
    const allChanges = userChanges.flat()
    allChanges.sort((a, b) => b.position - a.position)
    
    // Create a mutable copy of the original text
    let result = original
    
    // Apply each change
    for (const {insert, position} of allChanges) {
      result = result.substring(0, position) + insert + result.substring(position)
    }
    
    return result
  }

  /**
   * Create the final document content from merged paragraphs
   */
  private createFinalContent(mergedParagraphs: string[]): DocContent {
    return {
      type: 'doc',
      content: mergedParagraphs.map(text => ({
        type: 'paragraph',
        content: [{ type: 'text', text }]
      }))
    }
  }
}

export default SyncService.getInstance() 