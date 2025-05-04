import React, { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { nanoid } from 'nanoid'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import { PlusIcon, XCircleIcon } from '@heroicons/react/solid'

interface DialogueBubbleMenuProps {
  editor: Editor
}

// Helper to get unique speakers remains useful
const getUniqueSpeakers = (editor: Editor): string[] => {
  const names = new Set<string>()
  if (!editor || !editor.state || !editor.state.doc) {
    return []
  }
  editor.state.doc.descendants((node: ProseMirrorNode) => {
    node.marks.forEach(mark => {
      if (mark.type.name === 'dialogue' && mark.attrs.character) {
        names.add(mark.attrs.character)
      }
    })
  })
  // Simple sort for consistent order
  return Array.from(names).sort()
}

// Simple hash function for stable background colors
function simpleHashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

// Get a color based on the hash code
function getColorFromHashCode(hashCode: number): string {
  // Simple way to get a color hue
  const hue = Math.abs(hashCode) % 360
  return `hsl(${hue}, 70%, 80%)` // Use HSL for pastel-like colors
}

// --- End Helper Functions ---

const DialogueBubbleMenu: React.FC<DialogueBubbleMenuProps> = ({ editor }) => {
  const [existingSpeakers, setExistingSpeakers] = useState<string[]>([])
  const [showNewSpeakerInput, setShowNewSpeakerInput] = useState(false)
  const [newSpeakerName, setNewSpeakerName] = useState('')
  const [selectionHasDialogueMark, setSelectionHasDialogueMark] = useState(false) // State for mark detection

  // Fetch existing speakers when the editor updates
  useEffect(() => {
    const updateSpeakers = () => {
      setExistingSpeakers(getUniqueSpeakers(editor))
    }
    updateSpeakers()
    editor.on('transaction', updateSpeakers)
    return () => {
      editor.off('transaction', updateSpeakers)
    }
  }, [editor])

  // Check selection for dialogue mark on transaction/selection update
  useEffect(() => {
    const checkSelection = () => {
      const { selection } = editor.state
      const { from, to, empty } = selection
      let foundMark = false

      if (!empty) {
        editor.state.doc.nodesBetween(from, to, node => {
          if (node.marks.some(mark => mark.type.name === 'dialogue')) {
            foundMark = true
            return false // Stop iterating once found
          }
          return true
        })
      }
      setSelectionHasDialogueMark(foundMark)
    }

    // Check on initial mount and subsequent updates
    checkSelection()
    editor.on('transaction', checkSelection) // Covers content and selection changes

    return () => {
      editor.off('transaction', checkSelection)
    }
  }, [editor]) // Re-run if editor instance changes (though unlikely)

  const applyMark = (speaker: string) => {
    console.log('[applyMark] Called with speaker:', speaker)
    const finalSpeaker = speaker.trim()
    if (!finalSpeaker) return

    const { state } = editor
    const { selection } = state
    const { from, to } = selection
    const doc = state.doc

    let conversationIdToUse: string | null = null
    console.log('[applyMark] Starting range search for nearest conversation...')

    let closestIdBefore: string | null = null
    let closestPosBefore = -1
    let closestIdAfter: string | null = null
    let closestPosAfter = Infinity

    try {
      doc.nodesBetween(0, doc.content.size, (node, pos) => {
        if (!node.isText) return true // Only check text nodes

        const dialogueMark = node.marks.find(m => m.type.name === 'dialogue')
        // Check for both potential attribute casings, prioritizing camelCase
        const currentId = dialogueMark?.attrs.conversationId || dialogueMark?.attrs.conversationid || null

        if (dialogueMark && currentId) {
          // Check if we found an ID in either casing
          const nodeEndPos = pos + node.nodeSize

          console.log(
            `[applyMark] Found mark in range search at pos ${pos}-${nodeEndPos} with ID: ${currentId} (case: ${dialogueMark?.attrs.conversationId ? 'camel' : 'lower'})`,
          )

          // Check if this node overlaps or is *before* the selection start
          // We consider positions up to 'from' itself
          if (nodeEndPos <= from) {
            // Node ends before or at the selection start
            if (pos >= closestPosBefore) {
              // Found one closer (or same pos, take latest)
              closestIdBefore = currentId
              closestPosBefore = pos
              console.log(` -> Storing as closestBefore (pos ${pos})`)
            }
          } else if (pos >= to) {
            // Node starts at or after the selection end
            if (pos <= closestPosAfter) {
              // Found one closer (or same pos, take earliest)
              closestIdAfter = currentId
              closestPosAfter = pos
              console.log(` -> Storing as closestAfter (pos ${pos})`)
            }
          }
          // Note: This logic currently ignores marks *within* the selection range (from, to)
          // because we usually want to connect to neighbors, not overwrite the middle.
        }
        return true // Continue searching
      })
    } catch (error) {
      console.error('[applyMark] Error during nodesBetween search:', error)
    }

    // Prioritize the conversation found before the selection
    if (closestIdBefore) {
      conversationIdToUse = closestIdBefore
      console.log('[applyMark] Prioritizing closestBefore result:', conversationIdToUse)
    } else if (closestIdAfter) {
      conversationIdToUse = closestIdAfter
      console.log('[applyMark] Using closestAfter result:', conversationIdToUse)
    } else {
      console.log('[applyMark] No conversation found within search range.')
    }

    // Generate new ID if none found nearby
    const finalConversationId = conversationIdToUse || `conv-${nanoid(6)}`
    console.log('[applyMark] Using finalConversationId:', finalConversationId)

    // Apply the mark
    console.log('[applyMark] Attempting to set mark...')
    const result = editor
      .chain()
      .focus()
      .setDialogueMark({
        character: finalSpeaker,
        conversationId: finalConversationId,
        conversationName: undefined,
        userConfirmed: true,
      })
      .setTextSelection(to) // Move cursor to end of original selection
      .run()
    console.log('[applyMark] Mark setting result:', result)

    // Reset related state
    console.log('[applyMark] Resetting local state...')
    setShowNewSpeakerInput(false)
    setNewSpeakerName('')
  }

  const handleNewSpeakerSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault() // Prevent form submission if used in a form
    applyMark(newSpeakerName)
  }

  const handleRemoveDialogue = () => {
    editor.chain().focus().unsetDialogueMark().run()
    // No need to manually set selectionHasDialogueMark to false here,
    // the transaction listener in the useEffect will handle it.
  }

  return (
    <div className="min-w-[180px] rounded bg-white p-2 shadow-lg">
      {/* Speaker Selection */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Speaker:</span>
        {existingSpeakers.map(speaker => {
          const initial = speaker.charAt(0).toUpperCase()
          const bgColor = getColorFromHashCode(simpleHashCode(speaker))
          return (
            <button
              key={speaker}
              onClick={() => applyMark(speaker)}
              title={`Set speaker to: ${speaker}`}
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-gray-700 transition-transform hover:scale-110"
              style={{ backgroundColor: bgColor }}>
              {initial}
            </button>
          )
        })}
        {/* Add New Speaker Button/Input */}
        {!showNewSpeakerInput ? (
          <button
            onClick={() => setShowNewSpeakerInput(true)}
            title="Add new speaker"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-gray-400 bg-gray-100 text-gray-500 transition-colors hover:border-gray-500 hover:bg-gray-200 hover:text-gray-600">
            <PlusIcon className="h-4 w-4" />
          </button>
        ) : (
          <form onSubmit={handleNewSpeakerSubmit} className="flex items-center">
            <input
              type="text"
              value={newSpeakerName}
              onChange={e => setNewSpeakerName(e.target.value)}
              placeholder="New Speaker"
              className="h-6 flex-grow rounded-l border border-gray-300 px-1.5 py-0.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
              onBlur={() => {
                // Optional: Cancel if input is blurred and empty
                if (!newSpeakerName) {
                  setShowNewSpeakerInput(false)
                }
              }}
            />
            {/* Implicit submit on Enter, or add explicit button */}
            {/* <button type="submit" className="...">Add</button> */}
          </form>
        )}
      </div>

      {/* Remove Dialogue Button - Conditionally Rendered */}
      {selectionHasDialogueMark && (
        <div className="mt-1 border-t border-gray-200 pt-2">
          <button
            onClick={handleRemoveDialogue}
            className="flex w-full items-center justify-center gap-1 rounded bg-red-100 px-2 py-1 text-xs text-red-700 transition-colors hover:bg-red-200">
            <XCircleIcon className="h-3.5 w-3.5" />
            Remove Dialogue
          </button>
        </div>
      )}

      {/* Conversation Name Input Removed */}
    </div>
  )
}

export default DialogueBubbleMenu
