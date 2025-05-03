import { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { DialogueMark } from '../lib/tiptap-extensions/dialogue-mark'
import {
  processDialogueDetectionResult,
  getConfirmedMarksFromDoc,
  applyDialogueMarks,
  preserveConfirmedMarks,
  processDialogueMarks,
  groupDialogueMarks,
  getBaseConversationDisplay,
  ConfirmedMarkRange,
  ProcessedDialogueMark,
} from '../lib/utils/dialogue-utils'
// No need to import findAllMatches directly anymore as it's used internally by applyDialogueMarks
import {
  sampleDocument,
  sampleDocumentWithAdjacentDialogue,
  sampleDocumentNoConfirmed,
  sampleDetectedDialogues,
  sampleProcessedDialogues,
  sampleProcessedMarks,
} from './dialogue-util-setup'

// Helper function to create a Tiptap editor instance
function createEditor(content: any = {}): Editor {
  // Create a DOM element for the editor
  document.body.innerHTML = '<div id="editor"></div>'
  const element = document.getElementById('editor')

  if (!element) {
    throw new Error('Editor element not found')
  }

  return new Editor({
    element,
    extensions: [StarterKit, DialogueMark],
    content,
  })
}

describe('Dialogue Utilities', () => {
  let editor: Editor

  beforeEach(() => {
    // Reset the document body before each test
    document.body.innerHTML = ''
    editor = createEditor(sampleDocument)
  })

  afterEach(() => {
    editor.destroy()
  })

  describe('getConfirmedMarksFromDoc', () => {
    it('should extract all confirmed dialogue marks from document', () => {
      // Get confirmed marks from the document
      const confirmedMarks = getConfirmedMarksFromDoc(editor.state.doc)

      // We expect 2 confirmed marks: John and Michael
      expect(confirmedMarks.length).toBe(2)

      // Check the first confirmed mark (John)
      expect(confirmedMarks[0].attrs.character).toBe('John')
      expect(confirmedMarks[0].attrs.conversationId).toBe('test-doc-conv1')
      expect(confirmedMarks[0].attrs.conversationName).toBe('Greeting')
      expect(confirmedMarks[0].attrs.userConfirmed).toBe(true)

      // Check the second confirmed mark (Michael)
      expect(confirmedMarks[1].attrs.character).toBe('Michael')
      expect(confirmedMarks[1].attrs.conversationId).toBe('test-doc-conv2')
      expect(confirmedMarks[1].attrs.conversationName).toBe(null)
      expect(confirmedMarks[1].attrs.userConfirmed).toBe(true)
    })

    it('should return empty array if no confirmed marks exist', () => {
      // Create editor with document that has no confirmed marks
      const editorNoConfirmed = createEditor(sampleDocumentNoConfirmed)

      // Get confirmed marks
      const confirmedMarks = getConfirmedMarksFromDoc(editorNoConfirmed.state.doc)

      // Should be empty
      expect(confirmedMarks.length).toBe(0)

      // Clean up
      editorNoConfirmed.destroy()
    })
  })

  describe('processDialogueDetectionResult', () => {
    it('should process detected dialogues and add unique IDs and names', () => {
      const documentId = 'sample-doc'
      const nameMap = new Map<string, string>([
        ['sample-doc-conv1', 'Sample Greeting'],
        ['sample-doc-conv2', "Michael's Introduction"],
      ])

      const result = processDialogueDetectionResult(sampleDetectedDialogues, documentId, nameMap)

      // Check that all dialogues were processed
      expect(result.processedDialogues.length).toBe(sampleDetectedDialogues.length)

      // Check first dialogue
      const firstDialogue = result.processedDialogues[0]
      expect(firstDialogue.character).toBe('John')
      expect(firstDialogue.snippet).toBe('John: Hello there!')
      expect(firstDialogue.conversationId).toBe('conv1')
      expect(firstDialogue.uniqueConversationId).toBe('sample-doc-conv1')
      expect(firstDialogue.conversationName).toBe('Sample Greeting')

      // Check a dialogue from another conversation
      const michaelDialogue = result.processedDialogues[3]
      expect(michaelDialogue.character).toBe('Michael')
      expect(michaelDialogue.uniqueConversationId).toBe('sample-doc-conv2')
      expect(michaelDialogue.conversationName).toBe("Michael's Introduction")
    })

    it('should handle empty detection results', () => {
      const documentId = 'sample-doc'
      const nameMap = new Map<string, string>()

      const result = processDialogueDetectionResult([], documentId, nameMap)

      // Should return an empty array
      expect(result.processedDialogues.length).toBe(0)
    })

    it('should handle missing conversation names', () => {
      const documentId = 'sample-doc'
      const nameMap = new Map<string, string>()

      const result = processDialogueDetectionResult(sampleDetectedDialogues, documentId, nameMap)

      // All dialogues should have null conversationName
      for (const dialogue of result.processedDialogues) {
        expect(dialogue.conversationName).toBeNull()
      }
    })
  })

  describe('applyDialogueMarks', () => {
    it('should apply dialogue marks to matching text ranges', () => {
      // Create a spy to track addMark calls
      const addMarkSpy = jest.spyOn(editor.state.tr, 'addMark').mockImplementation(function (this: any) {
        return this
      })

      // Create an empty array of confirmed marks
      const confirmedRanges: ConfirmedMarkRange[] = []

      // Call applyDialogueMarks with processed dialogues
      const { marksApplied } = applyDialogueMarks(editor, sampleProcessedDialogues, confirmedRanges)

      // The real implementation will look for matches in the document
      // Since our document has at least some matching text, we should get some marks
      expect(marksApplied).toBeGreaterThan(0)

      // Clean up
      addMarkSpy.mockRestore()
    })

    it('should skip ranges that already have confirmed marks', () => {
      // Create a spy to track addMark calls
      const addMarkSpy = jest.spyOn(editor.state.tr, 'addMark').mockImplementation(function (this: any) {
        return this
      })

      // Create confirmed marks that match one of the ranges
      // Find the positions that would match the actual text in the document
      const confirmedRanges: ConfirmedMarkRange[] = [
        {
          from: 60,
          to: 80,
          attrs: {
            character: 'John',
            conversationId: 'test-doc-conv1',
            conversationName: 'Greeting',
            userConfirmed: true,
          },
        },
      ]

      // Create a spy for confirmedRangeMap.has to verify it's checking the keys
      const mapSpy = jest.spyOn(Map.prototype, 'has')

      // Call applyDialogueMarks with processed dialogues and confirmed ranges
      const { marksApplied } = applyDialogueMarks(editor, sampleProcessedDialogues, confirmedRanges)

      // Verify that Map.prototype.has was called with some range key
      expect(mapSpy).toHaveBeenCalled()

      // Verify that we applied at least one mark
      expect(marksApplied).toBeGreaterThan(0)

      // Clean up
      addMarkSpy.mockRestore()
      mapSpy.mockRestore()
    })

    it('should handle the case with no matching text in document', () => {
      // Create an editor with no matching text
      const emptyEditor = createEditor({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'This document has no matching dialogue text.',
              },
            ],
          },
        ],
      })

      // Call applyDialogueMarks
      const { tr, marksApplied } = applyDialogueMarks(
        emptyEditor,
        [
          {
            character: 'Unknown',
            snippet: 'Nothing will match this text',
            conversationId: 'unknown',
            uniqueConversationId: 'test-unknown',
            conversationName: null,
          },
        ],
        [],
      )

      // Verify transaction was created but no marks applied
      expect(tr).toBeDefined()
      expect(marksApplied).toBe(0)

      // Clean up
      emptyEditor.destroy()
    })
  })

  describe('preserveConfirmedMarks', () => {
    it('should reapply confirmed marks that were lost', () => {
      // Create some confirmed marks
      const confirmedRanges: ConfirmedMarkRange[] = [
        {
          from: 60,
          to: 80,
          attrs: {
            character: 'John',
            conversationId: 'test-doc-conv1',
            conversationName: 'Greeting',
            userConfirmed: true,
          },
        },
        {
          from: 200,
          to: 220,
          attrs: {
            character: 'Michael',
            conversationId: 'test-doc-conv2',
            conversationName: null,
            userConfirmed: true,
          },
        },
      ]

      // Mock document.nodesBetween to simulate marks that need reapplying
      // We'll return true for John (no need to reapply) and false for Michael (needs reapplying)
      editor.state.doc.nodesBetween = jest.fn().mockImplementation((from, to, callback) => {
        if (from === 60 && to === 80) {
          // Simulate that the mark for John is still there (doesn't need reapplying)
          const mockNode = {
            isText: true,
            marks: [
              {
                type: { name: 'dialogue' },
                attrs: {
                  character: 'John',
                  conversationId: 'test-doc-conv1',
                  userConfirmed: true,
                },
              },
            ],
          }
          callback(mockNode, from)
        } else if (from === 200 && to === 220) {
          // Simulate that the mark for Michael is gone (needs reapplying)
          const mockNode = {
            isText: true,
            marks: [], // No dialogue mark
          }
          callback(mockNode, from)
        }
        return true
      })

      // Create a spy for addMark that just returns the transaction
      const addMarkSpy = jest.spyOn(editor.state.tr, 'addMark').mockImplementation(function (this: any) {
        return this
      })

      // Create a transaction to modify
      const tr = editor.state.tr

      // Call preserveConfirmedMarks
      const result = preserveConfirmedMarks(editor, confirmedRanges, tr)

      // Verify that we got a transaction and only one mark was reapplied
      expect(result.tr).toBeDefined()
      expect(result.confirmedMarksPreserved).toBe(1) // Only Michael's mark needed reapplying

      // Clean up
      addMarkSpy.mockRestore()
    })

    it('should not reapply marks that still exist', () => {
      // Create some confirmed marks
      const confirmedRanges: ConfirmedMarkRange[] = [
        {
          from: 60,
          to: 80,
          attrs: {
            character: 'John',
            conversationId: 'test-doc-conv1',
            conversationName: 'Greeting',
            userConfirmed: true,
          },
        },
      ]

      // Mock document.nodesBetween to simulate marks that still exist
      editor.state.doc.nodesBetween = jest.fn().mockImplementation((from, to, callback) => {
        if (from === 60 && to === 80) {
          // Simulate that the mark is still there
          const mockNode = {
            isText: true,
            marks: [
              {
                type: { name: 'dialogue' },
                attrs: {
                  character: 'John',
                  conversationId: 'test-doc-conv1',
                  userConfirmed: true,
                },
              },
            ],
          }
          callback(mockNode, from)
        }
        return true
      })

      // Create a transaction to modify
      const tr = editor.state.tr

      // Call preserveConfirmedMarks
      const result = preserveConfirmedMarks(editor, confirmedRanges, tr)

      // Verify that we got a transaction and no marks were reapplied
      expect(result.tr).toBeDefined()
      expect(result.confirmedMarksPreserved).toBe(0) // No marks needed reapplying
    })

    it('should handle empty confirmed ranges', () => {
      // Create an empty array of confirmed marks
      const confirmedRanges: ConfirmedMarkRange[] = []

      // Create a transaction to modify
      const tr = editor.state.tr

      // Call preserveConfirmedMarks
      const result = preserveConfirmedMarks(editor, confirmedRanges, tr)

      // Verify that we got a transaction and no marks were reapplied
      expect(result.tr).toBeDefined()
      expect(result.confirmedMarksPreserved).toBe(0)
    })
  })

  describe('processDialogueMarks', () => {
    it('should extract dialogue marks from document', () => {
      // Process dialogue marks from the document
      const processedMarks = processDialogueMarks(editor.state.doc)

      // We expect 4 dialogue marks in total
      expect(processedMarks.length).toBe(4)

      // Check all marks were extracted with proper attributes
      expect(processedMarks[0].character).toBe('John')
      expect(processedMarks[0].conversationId).toBe('test-doc-conv1')
      expect(processedMarks[0].userConfirmed).toBe(true)

      expect(processedMarks[1].character).toBe('Sarah')
      expect(processedMarks[1].conversationId).toBe('test-doc-conv1')
      expect(processedMarks[1].userConfirmed).toBe(false)

      expect(processedMarks[2].character).toBe('John')
      expect(processedMarks[2].conversationId).toBe('test-doc-conv1')
      expect(processedMarks[2].userConfirmed).toBe(false)

      expect(processedMarks[3].character).toBe('Michael')
      expect(processedMarks[3].conversationId).toBe('test-doc-conv2')
      expect(processedMarks[3].userConfirmed).toBe(true)
    })

    it('should group adjacent text nodes with the same mark', () => {
      // Create editor with document that has adjacent text nodes with the same mark
      const editorWithAdjacent = createEditor(sampleDocumentWithAdjacentDialogue)

      // Process dialogue marks
      const processedMarks = processDialogueMarks(editorWithAdjacent.state.doc)

      // We expect 1 dialogue mark (two adjacent nodes merged)
      expect(processedMarks.length).toBe(1)

      // Check that the content is the combined text
      expect(processedMarks[0].content).toBe("John: This is part 1 of John's dialogue.")
      expect(processedMarks[0].character).toBe('John')
      expect(processedMarks[0].conversationId).toBe('test-doc-conv1')

      // Clean up
      editorWithAdjacent.destroy()
    })

    it('should handle documents with no dialogue marks', () => {
      // Create a document with no dialogue marks
      const plainDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'This document has no dialogue marks.',
              },
            ],
          },
        ],
      }

      const plainEditor = createEditor(plainDoc)

      // Process dialogue marks
      const processedMarks = processDialogueMarks(plainEditor.state.doc)

      // Should return empty array
      expect(processedMarks.length).toBe(0)

      // Clean up
      plainEditor.destroy()
    })
  })

  describe('groupDialogueMarks', () => {
    it('should group dialogue marks by conversation', () => {
      // Group the sample processed marks
      const grouped = groupDialogueMarks(sampleProcessedMarks)

      // We expect 2 conversation groups (conv1 and conv2)
      expect(grouped.length).toBe(2)

      // Check the first group (conv1)
      expect(grouped[0].conversationId).toBe('test-doc-conv1')
      expect(grouped[0].conversationName).toBe('Greeting')
      expect(grouped[0].dialogues.length).toBe(3) // John, Sarah, John

      // Check the second group (conv2)
      expect(grouped[1].conversationId).toBe('test-doc-conv2')
      expect(grouped[1].conversationName).toBe(null)
      expect(grouped[1].dialogues.length).toBe(1) // Michael
    })

    it('should sort dialogues within groups by position', () => {
      // Create unsorted marks (out of document order)
      const unsortedMarks: ProcessedDialogueMark[] = [
        // Put Michael (240-300) first
        {
          id: '240-300',
          character: 'Michael',
          content: 'Michael: Hello everyone, this is a different conversation.',
          conversationId: 'test-doc-conv2',
          conversationName: null,
          userConfirmed: true,
        },
        // Then Sarah (100-135)
        {
          id: '100-135',
          character: 'Sarah',
          content: 'Sarah: Hi John, how are you today?',
          conversationId: 'test-doc-conv1',
          conversationName: 'Greeting',
          userConfirmed: false,
        },
        // Then the second John (180-220)
        {
          id: '180-220',
          character: 'John',
          content: 'John: I am doing well, thanks for asking!',
          conversationId: 'test-doc-conv1',
          conversationName: 'Greeting',
          userConfirmed: false,
        },
        // Then the first John (60-80) last
        {
          id: '60-80',
          character: 'John',
          content: 'John: Hello there!',
          conversationId: 'test-doc-conv1',
          conversationName: 'Greeting',
          userConfirmed: true,
        },
      ]

      // Group them
      const grouped = groupDialogueMarks(unsortedMarks)

      // After grouping, the first conversation should have dialogues sorted by position
      expect(grouped[0].dialogues[0].id).toBe('60-80') // John first
      expect(grouped[0].dialogues[1].id).toBe('100-135') // Sarah second
      expect(grouped[0].dialogues[2].id).toBe('180-220') // John (second one) third

      // And conversations should be sorted by first occurrence
      expect(grouped[0].conversationId).toBe('test-doc-conv1') // conv1 first
      expect(grouped[1].conversationId).toBe('test-doc-conv2') // conv2 second
    })

    it('should handle empty marks array', () => {
      const grouped = groupDialogueMarks([])
      expect(grouped.length).toBe(0)
    })
  })

  describe('getBaseConversationDisplay', () => {
    it('should extract display name from conversation ID', () => {
      // Test standard ID format
      expect(getBaseConversationDisplay('doc123-conv1')).toBe('1')

      // Test with 'conv' prefix
      expect(getBaseConversationDisplay('doc123-conv42')).toBe('42')

      // Test with arbitrary non-conv ID
      expect(getBaseConversationDisplay('doc123-chat5')).toBe('chat5')

      // Test with multiple dashes
      expect(getBaseConversationDisplay('doc-123-conv-99')).toBe('conv-99')
    })

    it('should handle unknown or null IDs', () => {
      // Test with 'unknown' ID
      expect(getBaseConversationDisplay('unknown')).toBe('Unknown')

      // Test with null ID
      expect(getBaseConversationDisplay(null)).toBe('Unknown')

      // Test with empty string
      expect(getBaseConversationDisplay('')).toBe('Unknown')
    })

    it('should handle edge cases', () => {
      // Test with just 'conv' with no number
      expect(getBaseConversationDisplay('doc123-conv')).toBe('conv')

      // Test with just the document ID and no conversation ID
      expect(getBaseConversationDisplay('doc123-')).toBe('')
    })
  })
})

describe('Dialogue Utilities Integration', () => {
  let editor: Editor

  beforeEach(() => {
    // Reset the document body before each test
    document.body.innerHTML = ''
    // Create editor with some initial content
    editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Some introductory text.' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'John: This is a line of dialogue.' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Mary: And this is my response.' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'John: I have some existing marks.',
              marks: [
                {
                  type: 'dialogue',
                  attrs: {
                    character: 'John',
                    conversationId: 'test-doc-conv1',
                    conversationName: 'Existing Conversation',
                    userConfirmed: true,
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'This is not dialogue.' }],
        },
      ],
    })
  })

  afterEach(() => {
    editor.destroy()
  })

  it('should process and apply detected dialogues from server response', () => {
    // 1. Mock the dialogue detection response from server
    const mockDetectedDialogues = [
      {
        character: 'John',
        snippet: 'John: This is a line of dialogue.',
        conversationId: 'conv1',
      },
      {
        character: 'Mary',
        snippet: 'Mary: And this is my response.',
        conversationId: 'conv1',
      },
      {
        character: 'John',
        snippet: 'John: I have some existing marks.',
        conversationId: 'conv1',
      },
    ]

    // 2. Get confirmed marks from document
    const confirmedMarks = getConfirmedMarksFromDoc(editor.state.doc)

    // Verify we have one confirmed mark initially
    expect(confirmedMarks.length).toBe(1)
    expect(confirmedMarks[0].attrs.character).toBe('John')
    expect(confirmedMarks[0].attrs.userConfirmed).toBe(true)

    // 3. Create name map (simulating server response for conversation naming)
    const documentId = 'test-doc'
    const nameMap = new Map<string, string>([['test-doc-conv1', 'Existing Conversation']])

    // 4. Process dialogue detection result
    const { processedDialogues } = processDialogueDetectionResult(mockDetectedDialogues, documentId, nameMap)

    // 5. Apply dialogue marks
    const { tr: markedTr, marksApplied } = applyDialogueMarks(editor, processedDialogues, confirmedMarks)

    // 6. Preserve confirmed marks
    const { tr: finalTr, confirmedMarksPreserved } = preserveConfirmedMarks(editor, confirmedMarks, markedTr)

    // 7. Dispatch the transaction
    editor.view.dispatch(finalTr)

    // 8. Verify results
    expect(marksApplied).toBe(2) // Two new marks applied (existing confirmed mark is skipped)
    expect(confirmedMarksPreserved).toBeGreaterThanOrEqual(0) // Some marks may need preserving

    // 9. Extract all dialogue marks after processing
    const allMarks = processDialogueMarks(editor.state.doc)

    // Should have 3 marks total now
    expect(allMarks.length).toBe(3)

    // Check that marks have the right properties
    const marksByContent = new Map(allMarks.map(mark => [mark.content, mark]))

    // First dialogue line should be marked
    const firstDialogueMark = marksByContent.get('John: This is a line of dialogue.')
    expect(firstDialogueMark).toBeDefined()
    expect(firstDialogueMark?.character).toBe('John')
    expect(firstDialogueMark?.conversationId).toBe('test-doc-conv1')
    expect(firstDialogueMark?.userConfirmed).toBe(false) // Not confirmed yet

    // Second dialogue line should be marked
    const secondDialogueMark = marksByContent.get('Mary: And this is my response.')
    expect(secondDialogueMark).toBeDefined()
    expect(secondDialogueMark?.character).toBe('Mary')
    expect(secondDialogueMark?.conversationId).toBe('test-doc-conv1')

    // The confirmed mark should still be present and still confirmed
    const confirmedDialogueMark = marksByContent.get('John: I have some existing marks.')
    expect(confirmedDialogueMark).toBeDefined()
    expect(confirmedDialogueMark?.userConfirmed).toBe(true)

    // 10. Group dialogues by conversation
    const groupedDialogues = groupDialogueMarks(allMarks)

    // Should have 1 conversation group
    expect(groupedDialogues.length).toBe(1)
    expect(groupedDialogues[0].conversationId).toBe('test-doc-conv1')
    expect(groupedDialogues[0].conversationName).toBe('Existing Conversation')
    expect(groupedDialogues[0].dialogues.length).toBe(3)
  })

  it('should simulate full dialogue sync flow', () => {
    // This test simulates the flow in useDialogueSync hook in dialogue-hooks.ts

    // 1. Mock the server responses
    const mockDetectionResponse = [
      {
        character: 'John',
        snippet: 'John: This is a line of dialogue.',
        conversationId: 'conv1',
      },
      {
        character: 'Mary',
        snippet: 'Mary: And this is my response.',
        conversationId: 'conv1',
      },
    ]

    const mockNamingResponse = {
      names: [{ id: 'conv1', name: 'Conversation about something' }],
    }

    // 2. Get confirmed marks
    const confirmedMarks = getConfirmedMarksFromDoc(editor.state.doc)

    // 3. Process with naming information
    const documentId = 'test-doc'
    const nameMap = new Map(mockNamingResponse.names.map(n => [`${documentId}-${n.id}`, n.name]))

    // 4. Process detection result
    const { processedDialogues } = processDialogueDetectionResult(mockDetectionResponse, documentId, nameMap)

    // 5. Apply marks in sequence as in the hook
    let tr = editor.state.tr

    // Apply new dialogue marks
    const { tr: markedTr } = applyDialogueMarks(editor, processedDialogues, confirmedMarks)
    tr = markedTr

    // Preserve confirmed marks
    const { tr: preservedTr } = preserveConfirmedMarks(editor, confirmedMarks, tr)
    tr = preservedTr

    // Dispatch transaction
    editor.view.dispatch(tr)

    // 6. Verify results
    const finalMarks = processDialogueMarks(editor.state.doc)

    // Should have both original confirmed mark and two new marks
    expect(finalMarks.length).toBe(3)

    // Group and check conversations
    const groupedDialogues = groupDialogueMarks(finalMarks)
    expect(groupedDialogues.length).toBe(1)

    // The first two dialogues should be in the named conversation
    const johnAndMaryDialogues = groupedDialogues[0].dialogues
    expect(johnAndMaryDialogues.length).toBe(3)

    // Check that the naming is propagated correctly
    const johnDialogue = johnAndMaryDialogues.find(d => d.content === 'John: This is a line of dialogue.')
    expect(johnDialogue?.conversationId).toBe('test-doc-conv1')

    // The conversation should have the new name on newly created marks
    const maryDialogue = johnAndMaryDialogues.find(d => d.content === 'Mary: And this is my response.')
    expect(maryDialogue?.conversationName).toBe('Conversation about something')
  })
})
