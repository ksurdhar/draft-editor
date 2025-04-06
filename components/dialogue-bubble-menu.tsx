import React, { useState, useEffect } from 'react'
import { Editor } from '@tiptap/react'
import { nanoid } from 'nanoid'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import { PlusIcon } from '@heroicons/react/solid' // For the add button

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

const DialogueBubbleMenu: React.FC<DialogueBubbleMenuProps> = ({ editor }) => {
  const [existingSpeakers, setExistingSpeakers] = useState<string[]>([])
  const [showNewSpeakerInput, setShowNewSpeakerInput] = useState(false)
  const [newSpeakerName, setNewSpeakerName] = useState('')

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

  const applyMark = (speaker: string) => {
    const finalSpeaker = speaker.trim()
    if (!finalSpeaker) return

    const finalConversationId = `conv-${nanoid(6)}`

    editor
      .chain()
      .focus() // Ensure editor has focus before applying mark
      .setDialogueMark({
        character: finalSpeaker,
        conversationId: finalConversationId,
        conversationName: undefined,
        userConfirmed: true,
      })
      // Optional: Extend selection to applied mark? Or clear selection?
      .run()

    // Reset related state
    setShowNewSpeakerInput(false)
    setNewSpeakerName('')
  }

  const handleNewSpeakerSubmit = (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault() // Prevent form submission if used in a form
    applyMark(newSpeakerName)
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

      {/* Conversation Name Input Removed */}
    </div>
  )
}

export default DialogueBubbleMenu
