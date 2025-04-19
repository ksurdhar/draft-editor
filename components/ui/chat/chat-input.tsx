'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@components/ui/button'
import { Textarea } from '@components/ui/textarea'
import { SendIcon } from 'lucide-react'

type ChatInputProps = {
  onSendMessage: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resizeTextarea = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to properly calculate scrollHeight
    textarea.style.height = 'auto'

    // Set the height based on content, with a max height of 200px
    const newHeight = Math.min(textarea.scrollHeight, 200)
    textarea.style.height = `${newHeight}px`
  }

  // Resize on content change
  useEffect(() => {
    resizeTextarea()
  }, [message])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSendMessage(message)
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (message.trim()) {
        onSendMessage(message)
        setMessage('')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message"
            disabled={disabled}
            className="max-h-[200px] min-h-9 w-full resize-none overflow-y-auto py-2"
            rows={1}
          />
        </div>
        <Button type="submit" size="icon" disabled={disabled || !message.trim()} className="flex-shrink-0">
          <SendIcon className="h-4 w-4" />
        </Button>
      </div>
    </form>
  )
}
