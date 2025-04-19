'use client'

import { cn } from '@components/lib/utils'

type ChatMessageProps = {
  message: string
  isUser: boolean
  timestamp?: Date
}

export function ChatMessage({ message, isUser, timestamp }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'mb-4 flex w-max max-w-[80%] flex-col rounded-lg px-4 py-2',
        isUser ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
      )}>
      <div className="text-sm">{message}</div>
      {timestamp && (
        <div className="mt-1 text-right text-xs opacity-70">
          {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  )
}
