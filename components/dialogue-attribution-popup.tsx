'use client'
import React, { useState, useEffect, useRef } from 'react'
import { XIcon, CheckIcon } from '@heroicons/react/solid'

interface DialogueAttributionPopupProps {
  position: { top: number; left: number } | null
  initialCharacter?: string
  initialConversationId?: string
  onConfirm: (character: string, conversationId: string) => void
  onCancel: () => void
}

const DialogueAttributionPopup: React.FC<DialogueAttributionPopupProps> = ({
  position,
  initialCharacter = '',
  initialConversationId = '',
  onConfirm,
  onCancel,
}) => {
  const [character, setCharacter] = useState(initialCharacter)
  const [conversationId, setConversationId] = useState(initialConversationId)
  const popupRef = useRef<HTMLDivElement>(null)

  // Reset state when initial props change (e.g., new selection)
  useEffect(() => {
    setCharacter(initialCharacter)
    setConversationId(initialConversationId)
  }, [initialCharacter, initialConversationId])

  // Focus the first input when the popup appears
  useEffect(() => {
    if (position && popupRef.current) {
      const firstInput = popupRef.current.querySelector('input')
      firstInput?.focus()
    }
  }, [position])

  const handleConfirmClick = () => {
    if (character.trim() && conversationId.trim()) {
      onConfirm(character.trim(), conversationId.trim())
    }
  }

  // Handle clicks outside the popup to cancel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onCancel()
      }
    }

    if (position) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [position, onCancel])

  // Handle Escape key press to cancel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel])

  if (!position) {
    return null
  }

  return (
    <div
      ref={popupRef}
      className="absolute z-50 rounded-md border border-gray-300 bg-white p-3 shadow-lg"
      style={{ top: position.top, left: position.left }}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Attribute Dialogue</p>
        <button
          onClick={onCancel}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        <div>
          <label htmlFor="character-input" className="block text-xs font-medium text-gray-500">
            Speaker
          </label>
          <input
            id="character-input"
            type="text"
            value={character}
            onChange={e => setCharacter(e.target.value)}
            placeholder="Enter speaker name"
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="conversation-id-input" className="block text-xs font-medium text-gray-500">
            Conversation ID
          </label>
          <input
            id="conversation-id-input"
            type="text"
            value={conversationId}
            onChange={e => setConversationId(e.target.value)}
            placeholder="Enter conversation ID (e.g., conv1)"
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleConfirmClick()
              }
            }}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={handleConfirmClick}
          disabled={!character.trim() || !conversationId.trim()}
          className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-3 py-1 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
          <CheckIcon className="-ml-0.5 mr-1 h-4 w-4" />
          Confirm
        </button>
      </div>
    </div>
  )
}

export default DialogueAttributionPopup
