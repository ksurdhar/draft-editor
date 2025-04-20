'use client'

import { Send } from 'lucide-react'
import { Button } from '@components/ui/button'
import { Textarea } from '@components/ui/textarea'
import { KeyboardEvent, useRef, useState } from 'react'
import { EntityReference } from './chat-message'

interface ChatInputProps {
  onSendMessage: (message: string, entityRefs?: EntityReference[]) => void
  disabled?: boolean
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const [entityReferences, setEntityReferences] = useState<EntityReference[]>([])

  // Function to handle sending the message
  const handleSendMessage = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message, entityReferences.length > 0 ? entityReferences : undefined)
      setMessage('')
      setEntityReferences([])
    }
  }

  // Handle key events (Enter to send, Shift+Enter for new line)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Auto-resize the textarea based on content
  const handleAutoResize = () => {
    const textarea = textAreaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  // Handle input change
  const handleChange = (value: string) => {
    setMessage(value)
    handleAutoResize()

    // In Phase 2, we'll add logic here to detect '@' mentions and trigger entity selection
  }

  return (
    <div className="border-t p-4">
      <div className="relative flex items-center space-x-2">
        <Textarea
          ref={textAreaRef}
          value={message}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="max-h-[200px] min-h-[40px] resize-none overflow-hidden border-muted bg-transparent p-3 py-2"
          disabled={disabled}
          rows={1}
          onFocus={handleAutoResize}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || disabled}
          onClick={handleSendMessage}
          className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {entityReferences.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {entityReferences.map((ref, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-foreground">
              @{ref.type}:{ref.displayName}
              <button
                onClick={() => {
                  setEntityReferences(prev => prev.filter((_, index) => index !== i))
                }}
                className="ml-1 rounded-full hover:bg-primary/20">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
