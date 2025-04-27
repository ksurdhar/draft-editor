'use client'

import { Send, ChevronDown } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Textarea } from '@components/ui/textarea'
import { KeyboardEvent, useEffect, useRef, useState } from 'react'
import { EntityReference } from './chat-message'
import { useEntities, EntityType, AnyEntity } from '@components/providers'
import './chat-input.css'
import { EntitySelector } from './entity-selector'
import { FileText, MessageSquare, Camera, Folder } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover'
import { AI_MODELS } from '@lib/constants'
import { cn } from '@components/lib/utils'

// Entity icons
const ENTITY_ICONS = {
  document: <FileText className="h-3 w-3" />,
  conversation: <MessageSquare className="h-3 w-3" />,
  scene: <Camera className="h-3 w-3" />,
  folder: <Folder className="h-3 w-3" />,
}

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
  selectedModel: string
  onModelChange: (model: string) => void
}

export function ChatInput({ onSendMessage, disabled, selectedModel, onModelChange }: ChatInputProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { entities, filterEntities } = useEntities()
  const [message, setMessage] = useState('')
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [entityReferences, setEntityReferences] = useState<EntityReference[]>([])
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false)

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
      // Reset height to auto so it can shrink if needed
      textarea.style.height = 'auto'
      // Set height based on scrollHeight without a fixed limit
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  // Handle input change and detect @ mentions
  const handleChange = (value: string) => {
    const prevMessage = message
    setMessage(value)

    // Auto-resize on each input change
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

  // Set up event listeners for textarea
  useEffect(() => {
    const textarea = textAreaRef.current
    if (textarea) {
      textarea.addEventListener('select', handleSelectionChange)
      textarea.addEventListener('click', handleSelectionChange)
      textarea.addEventListener('keyup', handleSelectionChange)
      textarea.addEventListener('input', handleAutoResize)

      return () => {
        textarea.removeEventListener('select', handleSelectionChange)
        textarea.removeEventListener('click', handleSelectionChange)
        textarea.removeEventListener('keyup', handleSelectionChange)
        textarea.removeEventListener('input', handleAutoResize)
      }
    }
  }, [])

  return (
    <div className="border-t p-4" ref={containerRef}>
      {/* Entity references displayed above the input */}
      {entityReferences.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {entityReferences.map((ref, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
              title={`${ref.type}: ${ref.displayName}`}>
              {ENTITY_ICONS[ref.type as keyof typeof ENTITY_ICONS]}
              <span className="ml-1 mr-1">{ref.displayName}</span>
              <button
                onClick={() => {
                  setEntityReferences(prev => prev.filter((_, index) => index !== i))
                }}
                className="rounded-full hover:bg-primary/30">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        className={`relative overflow-visible rounded-xl border border-gray-200 dark:border-gray-700
          ${isMentionActive ? 'shadow-[0_0_0_1px] shadow-primary/20' : ''}
          group focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-0 dark:focus-within:ring-white
        `}>
        {/* Entity selector positioned just above the input area */}
        {entitySelector.isActive && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-full">
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

        <div className="flex flex-col">
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
            className="max-h-[500px] min-h-[100px] flex-1 resize-none overflow-y-auto border-0 !border-b-0 border-none bg-transparent p-3 py-2 !shadow-none shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ boxShadow: 'none' }}
            disabled={disabled}
            rows={3}
            onFocus={handleAutoResize}
          />

          <div className="flex items-center justify-between px-3 py-2">
            <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex h-6 items-center gap-1 p-0 text-sm text-muted-foreground hover:bg-transparent">
                  <span className="text-muted-foreground/70">
                    {selectedModel.includes('gpt-4') ? '4o' : selectedModel.replace('gpt-', '')}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-1" align="start" side="top" sideOffset={5}>
                <div className="grid gap-1">
                  {Object.entries(AI_MODELS).map(([provider, models]) => (
                    <div key={provider} className="p-1">
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </div>
                      {models.map(model => (
                        <Button
                          key={model.id}
                          variant="ghost"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            selectedModel === model.id && 'bg-accent text-accent-foreground',
                          )}
                          onClick={() => {
                            onModelChange(model.id)
                            setModelPopoverOpen(false)
                          }}>
                          {model.name}
                        </Button>
                      ))}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="submit"
              size="sm"
              disabled={!message.trim() || disabled}
              onClick={handleSendMessage}
              className="h-8 w-8 rounded-lg bg-primary p-0 text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
