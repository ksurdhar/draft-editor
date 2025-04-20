'use client'

import { Send } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Textarea } from '@components/ui/textarea'
import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { EntityReference } from './chat-message'
import { useEntities, EntityType, AnyEntity } from '@components/providers'
import './chat-input.css'
import { EntitySelector } from './entity-selector'

// Entity selector type to track the current selection state
type EntitySelectorState = {
  isActive: boolean
  searchTerm: string
  selectedType: EntityType | null
  startPosition: number
  endPosition: number
}

interface ChatInputProps {
  onSendMessage: (message: string, entityRefs?: EntityReference[]) => void
  disabled?: boolean
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { entities, filterEntities } = useEntities()
  const [message, setMessage] = useState('')
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [entityReferences, setEntityReferences] = useState<EntityReference[]>([])

  // Entity selector state
  const [entitySelector, setEntitySelector] = useState<EntitySelectorState>({
    isActive: false,
    searchTerm: '',
    selectedType: null,
    startPosition: 0,
    endPosition: 0,
  })

  // Handle cursor position tracking
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [cursorPosition, setCursorPosition] = useState<number>(0)

  // Function to handle sending the message
  const handleSendMessage = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message, entityReferences.length > 0 ? entityReferences : undefined)
      setMessage('')
      setEntityReferences([])
      // Reset entity selector
      setEntitySelector({
        isActive: false,
        searchTerm: '',
        selectedType: null,
        startPosition: 0,
        endPosition: 0,
      })
    }
  }

  // Track cursor position
  const handleSelectionChange = () => {
    if (textAreaRef.current) {
      setCursorPosition(textAreaRef.current.selectionStart)
    }
  }

  // Set up cursor position tracking
  useEffect(() => {
    const textarea = textAreaRef.current
    if (textarea) {
      textarea.addEventListener('select', handleSelectionChange)
      textarea.addEventListener('click', handleSelectionChange)
      textarea.addEventListener('keyup', handleSelectionChange)

      return () => {
        textarea.removeEventListener('select', handleSelectionChange)
        textarea.removeEventListener('click', handleSelectionChange)
        textarea.removeEventListener('keyup', handleSelectionChange)
      }
    }
  }, [])

  // Update selector position when it becomes active
  useEffect(() => {
    if (entitySelector.isActive) {
      // No longer need to update position
    }
  }, [entitySelector.isActive])

  // Close selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        entitySelector.isActive &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setEntitySelector(prev => ({
          ...prev,
          isActive: false,
        }))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [entitySelector.isActive])

  // Handle key events (Enter to send, Shift+Enter for new line, escape to cancel mention)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle Enter for sending message (only when not in entity selection mode)
    if (e.key === 'Enter' && !e.shiftKey && !entitySelector.isActive) {
      e.preventDefault()
      handleSendMessage()
      return
    }

    // Handle Backspace when at mention trigger position
    if (e.key === 'Backspace' && entitySelector.isActive) {
      const textarea = textAreaRef.current
      if (textarea && textarea.selectionStart <= entitySelector.startPosition + 1) {
        // If deleting the @ symbol, close the entity selector
        setEntitySelector({
          isActive: false,
          searchTerm: '',
          selectedType: null,
          startPosition: 0,
          endPosition: 0,
        })
      }
    }

    // We don't need to handle other entity selection keys here
    // as they're now handled by the EntitySelector component
  }

  // Auto-resize the textarea based on content
  const handleAutoResize = () => {
    const textarea = textAreaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
    }
  }

  // Handle input change and detect @ mentions
  const handleChange = (value: string) => {
    const prevMessage = message
    setMessage(value)
    handleAutoResize()

    const textarea = textAreaRef.current
    if (!textarea) return

    const curPos = textarea.selectionStart

    // Check if we're already in mention mode
    if (entitySelector.isActive) {
      // Check if the @ symbol has been deleted
      if (value.length < prevMessage.length && curPos <= entitySelector.startPosition) {
        setEntitySelector({
          isActive: false,
          searchTerm: '',
          selectedType: null,
          startPosition: 0,
          endPosition: 0,
        })
        return
      }

      // If the cursor moved outside the mention range, cancel mention mode
      if (curPos < entitySelector.startPosition || curPos > value.length) {
        setEntitySelector({
          isActive: false,
          searchTerm: '',
          selectedType: null,
          startPosition: 0,
          endPosition: 0,
        })
        return
      }

      // Update the search term regardless of whether a type is selected
      const searchTerm = value.substring(entitySelector.startPosition + 1, curPos)
      setEntitySelector(prev => ({
        ...prev,
        searchTerm,
        endPosition: curPos,
      }))
      return
    }

    // Check for @ character to activate mention mode
    if (value[curPos - 1] === '@') {
      // Only activate if @ is at the start of the message or has a space before it
      if (curPos === 1 || value[curPos - 2] === ' ') {
        setEntitySelector({
          isActive: true,
          searchTerm: '',
          selectedType: null,
          startPosition: curPos - 1,
          endPosition: curPos,
        })
      }
    }
  }

  // Handle entity type selection
  const handleSelectType = (type: EntityType) => {
    setEntitySelector(prev => ({
      ...prev,
      selectedType: type,
      searchTerm: '',
    }))

    // Focus back on textarea
    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }

  // Handle entity selection
  const handleSelectEntity = (entity: AnyEntity) => {
    // Create reference
    const reference: EntityReference = {
      type: entity.type,
      id: entity.id,
      displayName: entity.name,
      parentId: entity.parentId,
      parentType: entity.parentType,
    }

    // Add to references list
    setEntityReferences(prev => [...prev, reference])

    // Replace the mention text in the message with a placeholder
    const newMessage =
      message.substring(0, entitySelector.startPosition) + message.substring(entitySelector.endPosition)

    setMessage(newMessage)

    // Reset entity selector
    setEntitySelector({
      isActive: false,
      searchTerm: '',
      selectedType: null,
      startPosition: 0,
      endPosition: 0,
    })

    // Focus back on textarea
    if (textAreaRef.current) {
      textAreaRef.current.focus()
    }
  }

  // Handle closing the entity selector
  const handleCloseSelector = () => {
    setEntitySelector({
      isActive: false,
      searchTerm: '',
      selectedType: null,
      startPosition: 0,
      endPosition: 0,
    })
  }

  // Check if the mention mode is active and should show UI indicator
  const isMentionActive = entitySelector.isActive

  // Get the type of mention being entered
  const mentionType = entitySelector.selectedType

  return (
    <div className="border-t p-4" ref={containerRef}>
      {/* Entity references displayed above the input */}
      {entityReferences.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {entityReferences.map((ref, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              @{ref.type}:{ref.displayName}
              <button
                onClick={() => {
                  setEntityReferences(prev => prev.filter((_, index) => index !== i))
                }}
                className="ml-1 rounded-full hover:bg-primary/30">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={`relative flex items-center space-x-2 ${isMentionActive ? 'mention-active' : ''}`}>
        <div className="relative flex-1">
          {/* Entity selector positioned just above the input area, within the input container */}
          {entitySelector.isActive && (
            <div className="absolute bottom-full left-0 mb-1 w-full">
              <EntitySelector
                isActive={entitySelector.isActive}
                selectedType={entitySelector.selectedType}
                searchTerm={entitySelector.searchTerm}
                onSelect={handleSelectEntity}
                onSelectType={handleSelectType}
                onClose={handleCloseSelector}
              />
            </div>
          )}

          <Textarea
            ref={textAreaRef}
            value={message}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isMentionActive
                ? `Mention a ${mentionType || 'document/conversation/scene'}...`
                : 'Type a message...'
            }
            className={`
              max-h-[300px] min-h-[80px] w-full resize-none overflow-hidden 
              border-muted bg-transparent p-3 py-2
              ${isMentionActive ? 'border-primary ring-1 ring-primary/20' : ''}
            `}
            disabled={disabled}
            rows={3}
            onFocus={handleAutoResize}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || disabled}
          onClick={handleSendMessage}
          className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
