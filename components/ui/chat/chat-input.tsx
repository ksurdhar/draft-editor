'use client'

import { useState } from 'react'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { SendIcon } from 'lucide-react'

type ChatInputProps = {
  onSendMessage: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim()) {
      onSendMessage(message)
      setMessage('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-4">
      <Input
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Type your message..."
        disabled={disabled}
        className="flex-1"
      />
      <Button type="submit" size="icon" disabled={disabled || !message.trim()}>
        <SendIcon className="h-4 w-4" />
      </Button>
    </form>
  )
}
