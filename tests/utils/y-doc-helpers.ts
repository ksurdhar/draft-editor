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
 * Creates a new Y.Doc from a serialized state
 */
export function deserializeDocument(serialized: Uint8Array): Y.Doc {
  const doc = new Y.Doc()
  Y.applyUpdate(doc, serialized)
  return doc
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