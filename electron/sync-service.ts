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

  /**
   * Extract text content from paragraphs in a document
   */
  private extractParagraphTexts(content: DocContent): string[] {
    return content.content.map((p: any) => p.content?.[0]?.text || '')
  }
  
  /**
   * Find matching paragraphs between original document and a changed version
   * Returns a map of original paragraph index -> indices in the changed version
   */
  private findMatchingParagraphs(
    originalParagraphs: string[], 
    changedParagraphs: string[], 
    versionIdx: number,
    similarityThreshold = 0.3
  ): [number, number][] {
    const matches: [number, number][] = []
    
    for (let origIdx = 0; origIdx < originalParagraphs.length; origIdx++) {
      const origPara = originalParagraphs[origIdx]
      
      // Find best match in this version
      let bestMatchIdx = -1
      let bestMatchScore = 0
      
      for (let paraIdx = 0; paraIdx < changedParagraphs.length; paraIdx++) {
        const para = changedParagraphs[paraIdx]
        if (!para) continue
        
        const similarity = this.calculateSimilarity(origPara, para)
        if (similarity > bestMatchScore && similarity > similarityThreshold) {
          bestMatchScore = similarity
          bestMatchIdx = paraIdx
        }
      }
      
      if (bestMatchIdx !== -1) {
        matches.push([origIdx, bestMatchIdx])
      }
    }
    
    return matches
  }
  
  /**
   * Merge original paragraphs with their matched versions
   * Returns merged paragraphs and a set of processed paragraph keys
   */
  private mergeMatchedParagraphs(
    originalParagraphs: string[],
    allVersionsParagraphs: string[][],
    paragraphMatches: Map<number, [number, number][]>
  ): { mergedParagraphs: string[], processed: Set<string> } {
    const mergedParagraphs: string[] = []
    const processed = new Set<string>()
    
    for (let origIdx = 0; origIdx < originalParagraphs.length; origIdx++) {
      const origPara = originalParagraphs[origIdx]
      const matches = paragraphMatches.get(origIdx) || []
      
      // Collect all versions of this paragraph
      const versions = [origPara]
      for (const [versionIdx, paraIdx] of matches) {
        versions.push(allVersionsParagraphs[versionIdx + 1][paraIdx])
        processed.add(`${versionIdx}-${paraIdx}`)
      }
      
      // Merge all versions
      const mergedPara = this.mergeTextEdits(origPara, versions)
      mergedParagraphs.push(mergedPara)
    }
    
    return { mergedParagraphs, processed }
  }
  
  /**
   * Determine the best position to insert a new paragraph
   */
  private determineInsertPosition(
    paraIdx: number,
    positionMapping: {originalIdx: number, mergedIdx: number}[],
    totalParagraphs: number,
    mergedParagraphsLength: number
  ): number {
    // Default to end
    let insertAt = mergedParagraphsLength
    
    // Find the nearest mappings before and after this paragraph
    let prevMapping = null
    let nextMapping = null
    
    for (const mapping of positionMapping) {
      if (mapping.originalIdx < paraIdx) {
        prevMapping = mapping
      } else if (mapping.originalIdx > paraIdx && !nextMapping) {
        nextMapping = mapping
        break
      }
    }
    
    if (prevMapping && nextMapping) {
      // We have mappings both before and after
      // Insert proportionally between them based on relative position
      const originalGap = nextMapping.originalIdx - prevMapping.originalIdx
      const mergedGap = nextMapping.mergedIdx - prevMapping.mergedIdx
      
      const relativePos = (paraIdx - prevMapping.originalIdx) / originalGap
      insertAt = Math.round(prevMapping.mergedIdx + relativePos * mergedGap)
      
      // Ensure we don't insert beyond the next mapping (in case of rounding errors)
      insertAt = Math.min(insertAt, nextMapping.mergedIdx)
    } else if (prevMapping) {
      // Only have mapping before - insert after it
      insertAt = prevMapping.mergedIdx + 1
    } else if (nextMapping) {
      // Only have mapping after - insert before it
      insertAt = nextMapping.mergedIdx
    } else {
      // No mappings - use relative position in the document
      const relativePos = paraIdx / totalParagraphs
      insertAt = Math.floor(relativePos * mergedParagraphsLength)
    }
    
    // Ensure insertion point is within bounds
    return Math.max(0, Math.min(insertAt, mergedParagraphsLength))
  }
  
  /**
   * Find positions for new paragraphs and insert them
   */
  private insertNewParagraphs(
    mergedParagraphs: string[],
    processed: Set<string>,
    allVersionsParagraphs: string[][],
    changes: DocContent[]
  ): string[] {
    const result = [...mergedParagraphs]
    
    for (let versionIdx = 0; versionIdx < changes.length; versionIdx++) {
      const paragraphs = allVersionsParagraphs[versionIdx + 1]
      const versionParagraphs = changes[versionIdx].content.map((p: any) => p.content?.[0]?.text || '')
      
      // Create position mapping for this version
      const positionMapping = this.createPositionMapping(mergedParagraphs, versionParagraphs)
      
      // Process unprocessed paragraphs
      for (let paraIdx = 0; paraIdx < paragraphs.length; paraIdx++) {
        const key = `${versionIdx}-${paraIdx}`
        if (processed.has(key)) continue
        
        const para = paragraphs[paraIdx]
        if (!para) continue
        
        // Determine insertion position
        const insertAt = this.determineInsertPosition(
          paraIdx,
          positionMapping,
          versionParagraphs.length,
          result.length
        )
        
        // Insert the paragraph and mark as processed
        result.splice(insertAt, 0, para)
        processed.add(key)
        
        // Update position mappings after this insertion
        this.updatePositionMappings(positionMapping, insertAt)
      }
    }
    
    return result
  }
  
  /**
   * Create a mapping of paragraph positions between a version and the merged result
   */
  private createPositionMapping(
    mergedParagraphs: string[],
    versionParagraphs: string[]
  ): {originalIdx: number, mergedIdx: number}[] {
    const mapping: {originalIdx: number, mergedIdx: number}[] = []
    
    // For each paragraph in the version, find corresponding paragraph in merged result
    for (let versionParaIdx = 0; versionParaIdx < versionParagraphs.length; versionParaIdx++) {
      const versionPara = versionParagraphs[versionParaIdx]
      
      // Find best match in merged paragraphs
      let bestMatchIdx = -1
      let bestMatchScore = 0
      
      for (let mergedIdx = 0; mergedIdx < mergedParagraphs.length; mergedIdx++) {
        const mergedPara = mergedParagraphs[mergedIdx]
        const similarity = this.calculateSimilarity(versionPara, mergedPara)
        
        if (similarity > bestMatchScore && similarity > 0.5) {
          bestMatchScore = similarity
          bestMatchIdx = mergedIdx
        }
      }
      
      if (bestMatchIdx !== -1) {
        mapping.push({
          originalIdx: versionParaIdx,
          mergedIdx: bestMatchIdx
        })
      }
    }
    
    // Sort by original index
    return mapping.sort((a, b) => a.originalIdx - b.originalIdx)
  }
  
  /**
   * Update position mappings after inserting a paragraph
   */
  private updatePositionMappings(
    positionMapping: {originalIdx: number, mergedIdx: number}[],
    insertAt: number
  ): void {
    for (let i = 0; i < positionMapping.length; i++) {
      if (positionMapping[i].mergedIdx >= insertAt) {
        positionMapping[i].mergedIdx++
      }
    }
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

  async syncDocumentChanges(docId: string, changes: DocContent[]): Promise<DocumentData> {
    try {
      // Get the current document
      const doc = await this.getLocalDocument(docId)
      if (!doc) {
        throw new Error(`Document not found: ${docId}`)
      }

      // Extract initial content
      const initialContent = typeof doc.content === 'string' ? 
        { type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: doc.content }] }] } :
        (doc.content as DocContent)
      
      // Step 1: Extract paragraphs from all versions
      const originalParagraphs = this.extractParagraphTexts(initialContent)
      const allVersionsParagraphs = [
        originalParagraphs,
        ...changes.map(change => this.extractParagraphTexts(change))
      ]
      
      // Step 2: Find matching paragraphs across versions
      const paragraphMatches = new Map<number, [number, number][]>()
      
      for (let origIdx = 0; origIdx < originalParagraphs.length; origIdx++) {
        paragraphMatches.set(origIdx, [])
        
        for (let versionIdx = 0; versionIdx < changes.length; versionIdx++) {
          const changedParagraphs = allVersionsParagraphs[versionIdx + 1]
          const matches = this.findMatchingParagraphs(
            [originalParagraphs[origIdx]], 
            changedParagraphs,
            versionIdx
          )
          
          for (const match of matches) {
            // We only need the second value (matchIdx) from each match
            paragraphMatches.get(origIdx)?.push([versionIdx, match[1]])
          }
        }
      }
      
      // Step 3: Merge aligned paragraphs
      const { mergedParagraphs, processed } = this.mergeMatchedParagraphs(
        originalParagraphs,
        allVersionsParagraphs,
        paragraphMatches
      )
      
      // Step 4: Insert new paragraphs
      const finalParagraphs = this.insertNewParagraphs(
        mergedParagraphs,
        processed,
        allVersionsParagraphs,
        changes
      )
      
      // Step 5: Construct the final document
      const finalContent = this.createFinalContent(finalParagraphs)
      
      // Convert to YJS format for storage
      const ydoc = new Y.Doc()
      const state = applyTiptapChangesToSerializedYDoc(
        Y.encodeStateAsUpdate(ydoc),
        finalContent,
        schema
      )
      
      // Serialize for storage
      const serializedContent = {
        type: 'yjs',
        content: Array.from(state)
      }
      
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
}

export default SyncService.getInstance() 