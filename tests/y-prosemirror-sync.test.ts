import * as Y from 'yjs'
import { prosemirrorToYDoc, yDocToProsemirror } from 'y-prosemirror'
import { Schema } from 'prosemirror-model'

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

interface YDocPair {
  userADoc: Y.Doc
  userBDoc: Y.Doc
  xmlFragmentA: Y.XmlFragment
  xmlFragmentB: Y.XmlFragment
}

// Helper functions
function createDocPair(): YDocPair {
  const userADoc = new Y.Doc()
  const userBDoc = new Y.Doc()
  const xmlFragmentA = userADoc.getXmlFragment('prosemirror')
  const xmlFragmentB = userBDoc.getXmlFragment('prosemirror')
  return { userADoc, userBDoc, xmlFragmentA, xmlFragmentB }
}

function syncDocs(docA: Y.Doc, docB: Y.Doc) {
  const updateA = Y.encodeStateAsUpdate(docA)
  const updateB = Y.encodeStateAsUpdate(docB)
  Y.applyUpdate(docA, updateB)
  Y.applyUpdate(docB, updateA)
}

function createParagraph(text: string): Y.XmlElement {
  const p = new Y.XmlElement('paragraph')
  p.insert(0, [new Y.XmlText(text)])
  return p
}

function initializeDoc({ userADoc, userBDoc, xmlFragmentA }: YDocPair, initialText: string) {
  userADoc.transact(() => {
    const paragraph = createParagraph(initialText)
    xmlFragmentA.push([paragraph])
  })
  Y.applyUpdate(userBDoc, Y.encodeStateAsUpdate(userADoc))
}

function initializeDocWithParagraphs({ userADoc, userBDoc, xmlFragmentA }: YDocPair, texts: string[]) {
  userADoc.transact(() => {
    const paragraphs = texts.map(text => createParagraph(text))
    xmlFragmentA.push(paragraphs)
  })
  Y.applyUpdate(userBDoc, Y.encodeStateAsUpdate(userADoc))
}

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
    const finalDoc = yDocToProsemirror(schema, userADoc)

    expect(finalDoc.toJSON()).toEqual({
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
    const finalDoc = yDocToProsemirror(schema, userADoc)

    expect(finalDoc.toJSON()).toEqual({
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
    const finalDoc = yDocToProsemirror(schema, userADoc)

    expect(finalDoc.toJSON()).toEqual({
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
    const finalDoc = yDocToProsemirror(schema, userADoc)
    const finalText = finalDoc.toJSON().content[0].content[0].text
    
    expect(finalText).toContain('carefully')
    expect(finalText).toContain('quickly')
    expect(finalText.startsWith('Let\'s')).toBe(true)
    expect(finalText.endsWith('edit this text')).toBe(true)
  })
}) 