import fs from 'fs-extra'
import path from 'path'
import { ObjectId } from 'mongodb'
import * as Y from 'yjs'
import { StorageAdapter, Document, JsonDocument } from './types'
import { Schema } from 'prosemirror-model'
import { yDocToProsemirror } from 'y-prosemirror'
import { 
  serializeDocument, 
  applyTiptapChangesToSerializedYDoc
} from '../../tests/utils/y-doc-helpers'

// Define schema for Tiptap/ProseMirror operations
const schema = new Schema({
  nodes: {
    doc: {
      content: 'paragraph+'
    },
    paragraph: {
      content: 'text*',
      toDOM() { return ['p', 0] }
    },
    text: {
      group: 'inline'
    }
  }
})

export class YjsStorageAdapter implements StorageAdapter {
  private docs: Map<string, Y.Doc>
  private storagePath: string

  constructor() {
    this.docs = new Map()
    this.storagePath = process.env.JSON_STORAGE_PATH || './data'
    console.log('\n=== YjsStorageAdapter Initialization ===')
    console.log('Storage path:', this.storagePath)
  }

  private getDocumentsPath(collection: string) {
    return path.join(this.storagePath, collection)
  }

  private getDocumentPath(collection: string, id: string) {
    return path.join(this.getDocumentsPath(collection), `${id}.json`)
  }

  private getYDoc(id: string): Y.Doc {
    let ydoc = this.docs.get(id)
    if (!ydoc) {
      ydoc = new Y.Doc()
      this.docs.set(id, ydoc)
    }
    return ydoc
  }

  private ensureStringDates(doc: Record<string, any>): JsonDocument {
    return {
      ...doc,
      _id: doc._id,
      createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : new Date(doc.createdAt).toISOString(),
      updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : new Date(doc.updatedAt).toISOString()
    }
  }

  private serializeYDoc(ydoc: Y.Doc): Uint8Array {
    return serializeDocument(ydoc)
  }

  private deserializeYDoc(ydoc: Y.Doc, state: Uint8Array) {
    Y.applyUpdate(ydoc, state)
  }

  async create(collection: string, data: Omit<Document, '_id'>): Promise<JsonDocument> {
    console.log('\n=== YjsStorageAdapter.create ===')
    console.log('Collection:', collection)
    console.log('Input data:', data)

    // Create document metadata
    const newDoc: JsonDocument = {
      ...data as any,
      _id: new ObjectId().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Create YDoc for content
    const ydoc = this.getYDoc(newDoc._id)
    
    // If there's content, set it in the YDoc
    if (data.content) {
      // Apply content as Tiptap changes
      const state = applyTiptapChangesToSerializedYDoc(
        this.serializeYDoc(ydoc),
        data.content,
        schema
      )
      this.deserializeYDoc(ydoc, state)
    }

    // Serialize the complete document
    const documentToSave = {
      ...newDoc,
      content: {
        type: 'yjs',
        state: Array.from(this.serializeYDoc(ydoc))
      }
    }

    // Save to file
    const filePath = this.getDocumentPath(collection, newDoc._id)
    await fs.ensureDir(path.dirname(filePath))
    await fs.writeFile(filePath, JSON.stringify(documentToSave, null, 2))
    
    console.log('Created new document:', newDoc._id)
    return {
      ...newDoc,
      content: data.content
    }
  }

  async findById(collection: string, id: string): Promise<JsonDocument | null> {
    console.log('\n=== YjsStorageAdapter.findById ===')
    console.log('Collection:', collection)
    console.log('Document ID:', id)

    try {
      const filePath = this.getDocumentPath(collection, id)
      if (!fs.existsSync(filePath)) {
        console.log('Document not found')
        return null
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const doc = JSON.parse(content)
      
      // If the document has YJS content, deserialize it
      if (doc.content?.type === 'yjs' && Array.isArray(doc.content.state)) {
        const ydoc = this.getYDoc(id)
        this.deserializeYDoc(ydoc, new Uint8Array(doc.content.state))
        
        // Convert YDoc content to ProseMirror JSON
        const pmDoc = yDocToProsemirror(schema, ydoc)
        doc.content = pmDoc.toJSON()
      }

      return this.ensureStringDates(doc)
    } catch (error) {
      console.error('Error reading document:', error)
      return null
    }
  }

  async find(collection: string, query: Record<string, any> = {}): Promise<JsonDocument[]> {
    const documentsPath = this.getDocumentsPath(collection)
    if (!fs.existsSync(documentsPath)) {
      return []
    }

    try {
      const files = await fs.readdir(documentsPath)
      const documents = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => this.findById(collection, file.replace('.json', '')))
      )

      return documents
        .filter((doc): doc is JsonDocument => 
          doc !== null && 
          Object.entries(query).every(([key, value]) => doc[key] === value)
        )
    } catch (error) {
      console.error('Error reading documents:', error)
      return []
    }
  }

  async update(collection: string, id: string, data: Partial<Document>): Promise<JsonDocument> {
    console.log('\n=== YjsStorageAdapter.update ===')
    console.log('Collection:', collection)
    console.log('Document ID:', id)

    const existingDoc = await this.findById(collection, id)
    if (!existingDoc) {
      throw new Error(`Document not found: ${id}`)
    }

    const ydoc = this.getYDoc(id)

    // Update content if provided
    if (data.content) {
      // Clear existing content
      const fragment = ydoc.getXmlFragment('prosemirror')
      ydoc.transact(() => {
        fragment.delete(0, fragment.length)
      })

      // Apply new content
      const state = applyTiptapChangesToSerializedYDoc(
        this.serializeYDoc(ydoc),
        data.content,
        schema
      )
      this.deserializeYDoc(ydoc, state)
    }

    const updatedDoc = this.ensureStringDates({
      ...existingDoc,
      ...data,
      _id: id,
      content: {
        type: 'yjs',
        state: Array.from(this.serializeYDoc(ydoc))
      },
      updatedAt: new Date().toISOString()
    })

    const filePath = this.getDocumentPath(collection, id)
    await fs.writeFile(filePath, JSON.stringify(updatedDoc, null, 2))

    // Return the document with the updated content
    return {
      ...updatedDoc,
      content: data.content || existingDoc.content
    }
  }

  async delete(collection: string, query: Record<string, any>): Promise<boolean> {
    console.log('\n=== YjsStorageAdapter.delete ===')
    console.log('Collection:', collection)
    console.log('Query:', query)

    try {
      const documents = await this.find(collection, query)
      
      if (documents.length === 0) {
        return false
      }

      for (const doc of documents) {
        // Remove from memory
        this.docs.delete(doc._id)
        
        // Remove file
        const filePath = this.getDocumentPath(collection, doc._id)
        await fs.remove(filePath)
      }

      return true
    } catch (error) {
      console.error('Error deleting documents:', error)
      return false
    }
  }
} 