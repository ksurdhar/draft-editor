'use client'

import { cn } from '@components/lib/utils'

type ChatMessageProps = {
  message: string
  isUser: boolean
  timestamp?: Date
  isStreaming?: boolean
}

export function ChatMessage({ message, isUser, timestamp, isStreaming }: ChatMessageProps) {
  // Trim leading and trailing whitespace while preserving internal formatting
  const trimmedMessage = message.trim()

  // Split message by newlines and join with <br /> elements
  const formattedMessage = trimmedMessage.split('\n').map((line, i) => (
    <span key={i}>
      {line}
      {i < trimmedMessage.split('\n').length - 1 && <br />}
    </span>
  ))

  return (
    <div
      className={cn(
        'mb-4 flex w-max max-w-[80%] flex-col rounded-lg px-4 py-2',
        isUser ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        isStreaming && 'animate-pulse',
      )}>
      <div className="whitespace-pre-line text-sm">{formattedMessage}</div>
      {timestamp && (
        <div className="mt-1 text-right text-xs opacity-70">
          {isStreaming
            ? 'Typing...'
            : timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  )
}
