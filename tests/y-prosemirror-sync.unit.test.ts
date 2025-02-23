import * as Y from 'yjs'
import { Schema } from 'prosemirror-model'
import {
  createDocPair,
  syncDocs,
  createParagraph,
  initializeDoc,
  initializeDocWithParagraphs,
  serializeDocument,
  deserializeDocument,
  getDocumentJSON,
  verifyDocumentEquality,
  applyTiptapChangesToSerializedYDoc,
  createYDocFromBinary
} from './utils/y-doc-helpers'
import {prosemirrorToYDoc, yDocToProsemirror } from 'y-prosemirror'

// Define a simple schema for our test documents
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

describe('Y.js document merging', () => {
  test('merges concurrent changes from two users', () => {
    const { userADoc, userBDoc, xmlFragmentA, xmlFragmentB } = createDocPair()
    initializeDoc({ userADoc, userBDoc, xmlFragmentA, xmlFragmentB }, 'Hello world')

    // User A modifies their text
    userADoc.transact(() => {
      const paragraph = xmlFragmentA.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.delete(0, text.length)
      text.insert(0, 'Hello world, from user A')
    })

    // User B adds a new paragraph
    userBDoc.transact(() => {
      const newParagraph = createParagraph('A new paragraph from user B')
      xmlFragmentB.push([newParagraph])
    })

    // Sync and verify
    syncDocs(userADoc, userBDoc)
    expect(getDocumentJSON(userADoc, schema)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world, from user A' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A new paragraph from user B' }]
        }
      ]
    })
  })

  test('merges concurrent edits to the same paragraph', () => {
    const { userADoc, userBDoc, xmlFragmentA, xmlFragmentB } = createDocPair()
    initializeDoc({ userADoc, userBDoc, xmlFragmentA, xmlFragmentB }, 'The quick brown fox')

    // User A adds text to the beginning
    userADoc.transact(() => {
      const paragraph = xmlFragmentA.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(0, 'Once upon a time, ')
    })

    // User B adds text to the end
    userBDoc.transact(() => {
      const paragraph = xmlFragmentB.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(text.length, ' jumps over the lazy dog')
    })

    // Sync and verify
    syncDocs(userADoc, userBDoc)
    expect(getDocumentJSON(userADoc, schema)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ 
            type: 'text', 
            text: 'Once upon a time, The quick brown fox jumps over the lazy dog'
          }]
        }
      ]
    })
  })

  test('merges concurrent paragraph deletions and additions', () => {
    const { userADoc, userBDoc, xmlFragmentA, xmlFragmentB } = createDocPair()
    initializeDocWithParagraphs(
      { userADoc, userBDoc, xmlFragmentA, xmlFragmentB },
      ['First paragraph', 'Second paragraph', 'Third paragraph']
    )

    // User A deletes the second paragraph
    userADoc.transact(() => {
      xmlFragmentA.delete(1, 1)
    })

    // User B adds a new paragraph between first and second
    userBDoc.transact(() => {
      const newParagraph = createParagraph('New paragraph from B')
      xmlFragmentB.insert(1, [newParagraph])
    })

    // Sync and verify
    syncDocs(userADoc, userBDoc)
    expect(getDocumentJSON(userADoc, schema)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'New paragraph from B' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Third paragraph' }]
        }
      ]
    })
  })

  test('merges concurrent edits at the same position', () => {
    const { userADoc, userBDoc, xmlFragmentA, xmlFragmentB } = createDocPair()
    initializeDoc({ userADoc, userBDoc, xmlFragmentA, xmlFragmentB }, 'Let\'s edit this text')

    // Both users insert text at the same position
    userADoc.transact(() => {
      const paragraph = xmlFragmentA.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(5, ' carefully')
    })

    userBDoc.transact(() => {
      const paragraph = xmlFragmentB.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(5, ' quickly')
    })

    // Sync and verify
    syncDocs(userADoc, userBDoc)
    const finalText = getDocumentJSON(userADoc, schema).content[0].content[0].text
    
    expect(finalText).toContain('carefully')
    expect(finalText).toContain('quickly')
    expect(finalText.startsWith('Let\'s')).toBe(true)
    expect(finalText.endsWith('edit this text')).toBe(true)
  })

  test('merges changes after serialization and deserialization', () => {
    const { userADoc, userBDoc, xmlFragmentA, xmlFragmentB } = createDocPair()
    initializeDoc({ userADoc, userBDoc, xmlFragmentA, xmlFragmentB }, 'Initial content')

    // User A makes changes
    userADoc.transact(() => {
      const paragraph = xmlFragmentA.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(text.length, ' - edited by A')
    })

    // Serialize user A's document and create a new instance
    const serializedA = serializeDocument(userADoc)
    const deserializedA = deserializeDocument(serializedA)
    const deserializedAFragment = deserializedA.getXmlFragment('prosemirror')

    // User B makes changes
    userBDoc.transact(() => {
      const newParagraph = createParagraph('Added by B')
      xmlFragmentB.push([newParagraph])
    })

    // Serialize user B's document and create a new instance
    const serializedB = serializeDocument(userBDoc)
    const deserializedB = deserializeDocument(serializedB)

    // Verify deserialized documents match their originals
    expect(getDocumentJSON(deserializedA, schema))
      .toEqual(getDocumentJSON(userADoc, schema))
    expect(getDocumentJSON(deserializedB, schema))
      .toEqual(getDocumentJSON(userBDoc, schema))

    // Make additional changes to deserialized doc A
    deserializedA.transact(() => {
      const paragraph = deserializedAFragment.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(0, 'Updated: ')
    })

    // Sync the deserialized documents
    syncDocs(deserializedA, deserializedB)

    // Verify final merged state
    expect(getDocumentJSON(deserializedA, schema)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Updated: Initial content - edited by A' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Added by B' }]
        }
      ]
    })

    // Test that we can still sync with original documents
    syncDocs(deserializedA, userADoc)
    syncDocs(deserializedB, userBDoc)

    // All four documents should now have the same content
    verifyDocumentEquality([deserializedA, deserializedB, userADoc, userBDoc], schema)
  })

  test('handles concurrent edits across serialization boundaries', () => {
    const { userADoc, userBDoc, xmlFragmentA, xmlFragmentB } = createDocPair()
    initializeDoc({ userADoc, userBDoc, xmlFragmentA, xmlFragmentB }, 'Shared text')

    // User A makes changes and gets serialized
    userADoc.transact(() => {
      const paragraph = xmlFragmentA.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(0, 'A: ')
    })
    const serializedA = serializeDocument(userADoc)

    // User B makes changes
    userBDoc.transact(() => {
      const paragraph = xmlFragmentB.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(text.length, ' (B)')
    })

    // Create new document from A's serialized state
    const deserializedA = deserializeDocument(serializedA)
    const deserializedAFragment = deserializedA.getXmlFragment('prosemirror')

    // Make more changes to deserialized A
    deserializedA.transact(() => {
      const paragraph = deserializedAFragment.get(0) as Y.XmlElement
      const text = paragraph.get(0) as Y.XmlText
      text.insert(text.length, ' [A2]')
    })

    // Sync all three documents
    syncDocs(deserializedA, userBDoc)
    syncDocs(userADoc, deserializedA)

    const finalText = getDocumentJSON(deserializedA, schema).content[0].content[0].text

    // Verify all the pieces are present, without assuming their exact order
    expect(finalText).toContain('A: ')
    expect(finalText).toContain('Shared text')
    expect(finalText).toContain(' [A2]')
    expect(finalText).toContain(' (B)')

    // Verify the basic structure
    expect(finalText.startsWith('A: ')).toBe(true)
    expect(finalText.includes('Shared text')).toBe(true)

    // Verify all documents converged to the same state
    verifyDocumentEquality([deserializedA, userADoc, userBDoc], schema)
  })

  test('syncs changes from ProseMirror to Y.doc', () => {
    // Create initial ProseMirror document
    const pmDoc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('Initial text')
      ])
    ])

    // Convert ProseMirror doc to Y.doc
    const userADoc = new Y.Doc()
    const userBDoc = new Y.Doc()
    
    // Get the XML fragments that will be synced
    const fragmentA = userADoc.getXmlFragment('prosemirror')
    const fragmentB = userBDoc.getXmlFragment('prosemirror')

    // Initialize the first document with content
    userADoc.transact(() => {
      const paragraph = new Y.XmlElement('paragraph')
      paragraph.insert(0, [new Y.XmlText('Initial text')])
      fragmentA.insert(0, [paragraph])
    })

    // Sync initial state
    syncDocs(userADoc, userBDoc)

    // Make changes to the first Y.doc
    userADoc.transact(() => {
      const paragraph = fragmentA.get(0)
      if (paragraph instanceof Y.XmlElement) {
        paragraph.insert(paragraph.length, [new Y.XmlText(' - edited')])
      }
    })

    // Sync the documents
    syncDocs(userADoc, userBDoc)

    // Convert to ProseMirror format and verify
    const docA = getDocumentJSON(userADoc, schema)
    const docB = getDocumentJSON(userBDoc, schema)
    
    expect(docA).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Initial text' },
          { type: 'text', text: ' - edited' }
        ]
      }]
    })
    
    expect(docA).toEqual(docB)
  })

  test('handles concurrent ProseMirror edits', () => {
    // Create Y.docs
    const userADoc = new Y.Doc()
    const userBDoc = new Y.Doc()
    
    // Get fragments
    const fragmentA = userADoc.getXmlFragment('prosemirror')
    const fragmentB = userBDoc.getXmlFragment('prosemirror')

    // Initialize with content
    userADoc.transact(() => {
      const paragraph = new Y.XmlElement('paragraph')
      paragraph.insert(0, [new Y.XmlText('Shared content')])
      fragmentA.insert(0, [paragraph])
    })

    // Sync initial state
    syncDocs(userADoc, userBDoc)

    // User A adds text at the beginning
    userADoc.transact(() => {
      const paragraph = fragmentA.get(0)
      if (paragraph instanceof Y.XmlElement) {
        paragraph.insert(0, [new Y.XmlText('A: ')])
      }
    })

    // User B adds text at the end
    userBDoc.transact(() => {
      const paragraph = fragmentB.get(0)
      if (paragraph instanceof Y.XmlElement) {
        paragraph.insert(paragraph.length, [new Y.XmlText(' (B)')])
      }
    })

    // Sync the documents
    syncDocs(userADoc, userBDoc)

    // Convert to ProseMirror format and verify
    const docA = getDocumentJSON(userADoc, schema)
    const docB = getDocumentJSON(userBDoc, schema)
    
    expect(docA).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'A: ' },
          { type: 'text', text: 'Shared content' },
          { type: 'text', text: ' (B)' }
        ]
      }]
    })
    
    expect(docA).toEqual(docB)
  })

  test('syncs two Tiptap JSON documents with different changes', () => {
    // Create a Y.doc and initialize it with the base content
    const baseDoc = new Y.Doc()
    const baseFragment = baseDoc.getXmlFragment('prosemirror')
    baseDoc.transact(() => {
      const paragraph = new Y.XmlElement('paragraph')
      paragraph.insert(0, [new Y.XmlText('Initial content')])
      baseFragment.insert(0, [paragraph])
    })

    // Create two Y.docs from the base state
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(baseDoc))
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(baseDoc))

    // Apply User A's changes
    docA.transact(() => {
      const fragmentA = docA.getXmlFragment('prosemirror')
      const paragraph = fragmentA.get(0) as Y.XmlElement
      paragraph.insert(0, [new Y.XmlText('A: ')])
    })

    // Apply User B's changes
    docB.transact(() => {
      const fragmentB = docB.getXmlFragment('prosemirror')
      const paragraph = fragmentB.get(0) as Y.XmlElement
      paragraph.insert(paragraph.length, [new Y.XmlText(' (B)')])
    })

    // Sync the documents
    syncDocs(docA, docB)

    // Convert to ProseMirror format and verify
    const finalJSON = yDocToProsemirror(schema, docA).toJSON()
    const paragraphContent = finalJSON.content[0].content
    const fullText = paragraphContent.map((node: { text: string }) => node.text).join('')

    // Verify all parts are present in the correct order
    expect(fullText).toContain('A: ')
    expect(fullText).toContain('Initial content')
    expect(fullText).toContain('(B)')
    expect(fullText.startsWith('A: ')).toBe(true)
    expect(fullText.endsWith('(B)')).toBe(true)

    // Both docs should have the same content
    expect(yDocToProsemirror(schema, docB).toJSON()).toEqual(finalJSON)
  })

  test('syncs complex document changes with multiple paragraphs', () => {
    // Create a Y.doc and initialize it with the base content
    const baseDoc = new Y.Doc()
    const baseFragment = baseDoc.getXmlFragment('prosemirror')
    baseDoc.transact(() => {
      const paragraph = new Y.XmlElement('paragraph')
      paragraph.insert(0, [new Y.XmlText('First paragraph')])
      baseFragment.insert(0, [paragraph])
    })

    // Create two Y.docs from the base state
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(baseDoc))
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(baseDoc))

    // Apply User A's changes - add a new paragraph
    docA.transact(() => {
      const fragmentA = docA.getXmlFragment('prosemirror')
      const newParagraph = new Y.XmlElement('paragraph')
      newParagraph.insert(0, [new Y.XmlText('Added by A')])
      fragmentA.push([newParagraph])
    })

    // Apply User B's changes - modify the first paragraph
    docB.transact(() => {
      const fragmentB = docB.getXmlFragment('prosemirror')
      const paragraph = fragmentB.get(0) as Y.XmlElement
      paragraph.insert(paragraph.length, [new Y.XmlText(' - edited by B')])
    })

    // Sync the documents
    syncDocs(docA, docB)

    // Get the merged result
    const finalJSON = yDocToProsemirror(schema, docA).toJSON()

    // Verify the structure
    expect(finalJSON.type).toBe('doc')
    expect(finalJSON.content.length).toBe(2)

    // Verify the content of both paragraphs
    const paragraphs = finalJSON.content
    const firstParagraphText = paragraphs[0].content.map((node: { text: string }) => node.text).join('')
    const secondParagraphText = paragraphs[1].content.map((node: { text: string }) => node.text).join('')

    // First paragraph should contain both the original text and B's edit
    expect(firstParagraphText).toBe('First paragraph - edited by B')
    // Second paragraph should be the one added by A
    expect(secondParagraphText).toBe('Added by A')

    // Both docs should have converged to the same state
    expect(yDocToProsemirror(schema, docB).toJSON()).toEqual(finalJSON)
  })

  test('syncs changes made at Tiptap JSON level', () => {
    // Initial document state
    const initialJSON = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Initial content' }]
      }]
    }

    // Create initial ProseMirror document and convert to Y.doc
    const initialPmDoc = schema.nodeFromJSON(initialJSON)
    const baseYDoc = prosemirrorToYDoc(initialPmDoc)

    // Create two Y.docs from the base state
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(baseYDoc))
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(baseYDoc))

    // User A makes changes in Tiptap (JSON level)
    const userAChanges = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Initial content - edited by A' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'New paragraph from A' }]
        }
      ]
    }

    // User B makes different changes in Tiptap (JSON level)
    const userBChanges = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Modified content by B' }]
        }
      ]
    }

    // Convert Tiptap JSON changes to Y.doc updates
    const serializedInitial = Y.encodeStateAsUpdate(docA)
    const serializedWithAChanges = applyTiptapChangesToSerializedYDoc(
      serializedInitial,
      userAChanges,
      schema
    )

    // Meanwhile, User B makes changes at the Tiptap JSON level
    const serializedWithBChanges = applyTiptapChangesToSerializedYDoc(
      serializedInitial,
      userBChanges,
      schema
    )

    // Apply the updates to the respective Y.docs
    Y.applyUpdate(docA, serializedWithAChanges)
    Y.applyUpdate(docB, serializedWithBChanges)

    // Sync the documents
    syncDocs(docA, docB)

    // Convert back to JSON to verify the merged state
    const finalJSON = yDocToProsemirror(schema, docA).toJSON()

    // The final document should contain elements from both changes
    expect(finalJSON.type).toBe('doc')
    
    // Get all text content from the document
    const allTexts = finalJSON.content
      .map((p: { content: Array<{ text: string }> }) => 
        p.content.map((n: { text: string }) => n.text).join('')
      )

    // Verify that content from both users is preserved
    const hasUserAContent = allTexts.some((text: string) => 
      text.includes('edited by A') || text.includes('New paragraph from A')
    )
    const hasUserBContent = allTexts.some((text: string) => 
      text.includes('Modified content by B')
    )

    expect(hasUserAContent).toBe(true)
    expect(hasUserBContent).toBe(true)

    // Both docs should have converged to the same state
    expect(yDocToProsemirror(schema, docB).toJSON()).toEqual(finalJSON)
  })

  test('handles complex Tiptap JSON changes with nested structures', () => {
    // Initial document with nested structure
    const initialJSON = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Root paragraph' }]
      }]
    }

    // Create initial state
    const initialPmDoc = schema.nodeFromJSON(initialJSON)
    const baseYDoc = prosemirrorToYDoc(initialPmDoc)
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(baseYDoc))
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(baseYDoc))

    // User A adds content and modifies existing content
    const userAChanges = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Modified root by A' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A\'s new content' }]
        }
      ]
    }

    // User B restructures the document
    const userBChanges = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'B\'s new first paragraph' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Root paragraph - edited by B' }]
        }
      ]
    }

    // Convert and apply changes for both users
    const pmDocA = schema.nodeFromJSON(userAChanges)
    const pmDocB = schema.nodeFromJSON(userBChanges)
    
    const yDocAFromChanges = prosemirrorToYDoc(pmDocA)
    const yDocBFromChanges = prosemirrorToYDoc(pmDocB)

    Y.applyUpdate(docA, Y.encodeStateAsUpdate(yDocAFromChanges))
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(yDocBFromChanges))

    // Sync the documents
    syncDocs(docA, docB)

    // Get the final merged state
    const finalJSON = yDocToProsemirror(schema, docA).toJSON()

    // Verify the structure
    expect(finalJSON.type).toBe('doc')
    expect(finalJSON.content.length).toBeGreaterThan(1)

    // Convert the content to a flat array of text for easier verification
    const allTexts = finalJSON.content
      .map((p: { content: Array<{ text: string }> }) => 
        p.content.map((n: { text: string }) => n.text).join('')
      )

    // Verify that content from both users is preserved
    expect(allTexts.some((text: string) => 
      text.includes('Modified root by A') || text.includes('B\'s new first paragraph')
    )).toBe(true)
    expect(allTexts.some((text: string) => 
      text.includes('A\'s new content') || text.includes('edited by B')
    )).toBe(true)

    // Both docs should have converged to the same state
    expect(yDocToProsemirror(schema, docB).toJSON()).toEqual(finalJSON)
  })

  test('handles full flow: Y.doc -> Tiptap -> Y.doc updates -> serialization -> merge', () => {
    // Start with a Y.doc containing initial content
    const initialYDoc = new Y.Doc()
    const initialFragment = initialYDoc.getXmlFragment('prosemirror')
    initialYDoc.transact(() => {
      const paragraph = new Y.XmlElement('paragraph')
      paragraph.insert(0, [new Y.XmlText('Initial content')])
      initialFragment.insert(0, [paragraph])
    })

    // User A makes changes at the Tiptap JSON level
    const userAChanges = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Initial content - modified by A' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'A\'s new paragraph' }]
        }
      ]
    }

    // Convert Tiptap JSON changes to Y.doc updates
    const serializedInitial = Y.encodeStateAsUpdate(initialYDoc)
    const serializedWithAChanges = applyTiptapChangesToSerializedYDoc(
      serializedInitial,
      userAChanges,
      schema
    )

    // Meanwhile, User B makes changes at the Tiptap JSON level
    const userBChanges = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Initial content (B\'s edit)' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'B\'s new paragraph' }]
        }
      ]
    }

    // Convert B's Tiptap changes to Y.doc updates
    const yDocB = createYDocFromBinary(serializedInitial)
    const serializedWithBChanges = applyTiptapChangesToSerializedYDoc(
      serializedInitial,
      userBChanges,
      schema
    )
    Y.applyUpdate(yDocB, serializedWithBChanges)

    // Deserialize A's document and sync with B
    const deserializedA = createYDocFromBinary(serializedWithAChanges)
    syncDocs(deserializedA, yDocB)

    // Convert final state to JSON and verify
    const finalJSON = yDocToProsemirror(schema, deserializedA).toJSON()

    // Verify structure
    expect(finalJSON.type).toBe('doc')
    expect(finalJSON.content.length).toBeGreaterThan(1)

    // Get all text content
    const allTexts = finalJSON.content
      .map((p: { content: Array<{ text: string }> }) => 
        p.content.map((n: { text: string }) => n.text).join('')
      )

    // Verify all changes are preserved
    const hasUserAContent = allTexts.some((text: string) => 
      text.includes('modified by A') || text.includes('A\'s new paragraph')
    )
    const hasUserBContent = allTexts.some((text: string) => 
      text.includes('B\'s edit') || text.includes('B\'s new paragraph')
    )

    expect(hasUserAContent).toBe(true)
    expect(hasUserBContent).toBe(true)

    // Both docs should have converged to the same state
    expect(yDocToProsemirror(schema, yDocB).toJSON()).toEqual(finalJSON)

    // Original doc should also sync correctly
    syncDocs(initialYDoc, deserializedA)
    expect(yDocToProsemirror(schema, initialYDoc).toJSON()).toEqual(finalJSON)
  })
}) 