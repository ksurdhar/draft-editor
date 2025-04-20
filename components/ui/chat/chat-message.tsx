'use client'

import { cn } from '@components/lib/utils'
import { EntityType } from '@components/providers'

// Entity reference type definition
export type EntityReference = {
  type: EntityType
  id: string
  displayName: string
  parentId?: string
  parentType?: EntityType
}

export type ChatMessageProps = {
  message: string
  isUser: boolean
  timestamp?: Date
  isStreaming?: boolean
  entityReferences?: EntityReference[]
}

export function ChatMessage({ message, isUser, timestamp, isStreaming, entityReferences }: ChatMessageProps) {
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
      <div className="whitespace-pre-line text-sm">
        {formattedMessage}
        {entityReferences && entityReferences.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {entityReferences.map((ref, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-foreground">
                @{ref.type}:{ref.displayName}
              </span>
            ))}
          </div>
        )}
      </div>
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
