import * as Y from 'yjs'
import { Schema } from 'prosemirror-model'
import { prosemirrorToYDoc, yDocToProsemirror } from 'y-prosemirror'

export interface YDocPair {
  userADoc: Y.Doc
  userBDoc: Y.Doc
  xmlFragmentA: Y.XmlFragment
  xmlFragmentB: Y.XmlFragment
}

/**
 * Creates a pair of Y.Doc instances with their XML fragments
 */
export function createDocPair(): YDocPair {
  const userADoc = new Y.Doc()
  const userBDoc = new Y.Doc()
  const xmlFragmentA = userADoc.getXmlFragment('prosemirror')
  const xmlFragmentB = userBDoc.getXmlFragment('prosemirror')
  return { userADoc, userBDoc, xmlFragmentA, xmlFragmentB }
}

/**
 * Synchronizes two Y.Doc instances by exchanging their updates
 */
export function syncDocs(docA: Y.Doc, docB: Y.Doc) {
  const updateA = Y.encodeStateAsUpdate(docA)
  const updateB = Y.encodeStateAsUpdate(docB)
  Y.applyUpdate(docA, updateB)
  Y.applyUpdate(docB, updateA)
}

/**
 * Creates a new paragraph element with the given text
 */
export function createParagraph(text: string): Y.XmlElement {
  const p = new Y.XmlElement('paragraph')
  p.insert(0, [new Y.XmlText(text)])
  return p
}

/**
 * Initializes a document pair with a single paragraph
 */
export function initializeDoc({ userADoc, userBDoc, xmlFragmentA }: YDocPair, initialText: string) {
  userADoc.transact(() => {
    const paragraph = createParagraph(initialText)
    xmlFragmentA.push([paragraph])
  })
  Y.applyUpdate(userBDoc, Y.encodeStateAsUpdate(userADoc))
}

/**
 * Initializes a document pair with multiple paragraphs
 */
export function initializeDocWithParagraphs({ userADoc, userBDoc, xmlFragmentA }: YDocPair, texts: string[]) {
  userADoc.transact(() => {
    const paragraphs = texts.map(text => createParagraph(text))
    xmlFragmentA.push(paragraphs)
  })
  Y.applyUpdate(userBDoc, Y.encodeStateAsUpdate(userADoc))
}

/**
 * Serializes a Y.Doc to a Uint8Array
 */
export function serializeDocument(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc)
}

/**
 * Creates a new Y.Doc from binary data
 */
export function createYDocFromBinary(binary: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, binary)
  return doc
}

/**
 * Creates a new Y.Doc from a serialized state
 * @deprecated Use createYDocFromBinary instead
 */
export function deserializeDocument(serialized: Uint8Array): Y.Doc {
  return createYDocFromBinary(serialized)
}

/**
 * Gets the JSON representation of a Y.Doc using the given schema
 */
export function getDocumentJSON(doc: Y.Doc, schema: Schema) {
  return yDocToProsemirror(schema, doc).toJSON()
}

/**
 * Verifies that all documents have converged to the same state
 */
export function verifyDocumentEquality(docs: Y.Doc[], schema: Schema) {
  const contents = docs.map(doc => getDocumentJSON(doc, schema))
  const firstContent = contents[0]
  contents.forEach(content => {
    expect(content).toEqual(firstContent)
  })
}

/**
 * Applies Tiptap JSON changes to a serialized Y.doc state and returns the new serialized state
 */
export function applyTiptapChangesToSerializedYDoc(
  serializedYDoc: Uint8Array,
  tiptapChanges: any,
  schema: Schema
): Uint8Array {
  // Create a new Y.doc and apply the serialized state
  const yDoc = new Y.Doc()
  Y.applyUpdate(yDoc, serializedYDoc)

  // Convert Tiptap changes to Y.doc updates
  const pmDoc = schema.nodeFromJSON(tiptapChanges)
  const yDocFromChanges = prosemirrorToYDoc(pmDoc)
  
  // Apply the changes
  Y.applyUpdate(yDoc, Y.encodeStateAsUpdate(yDocFromChanges))

  // Return the new serialized state
  return Y.encodeStateAsUpdate(yDoc)
} 