'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@components/ui/button'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { cn } from '@components/lib/utils'
import { toast } from 'sonner'
import { useEntities } from '@components/providers'
import { EntityReference } from './chat-message'

type MessageRole = 'user' | 'assistant' | 'system'

type Message = {
  id: string
  content: string
  isUser: boolean
  role: MessageRole
  timestamp: Date
  isStreaming?: boolean
  entityReferences?: EntityReference[] // Added entity references
}

// Check if we're in Electron environment
const isElectron = typeof window !== 'undefined' && window.electronAPI

type ChatPanelProps = {
  isOpen: boolean
  onClose: () => void
  className?: string
  documentId?: string
  documentContext?: string
}

export function ChatPanel({ isOpen, onClose, className, documentId, documentContext }: ChatPanelProps) {
  // We're importing the context but not using it yet - will be used in Phase 2
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { entities } = useEntities()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      content: 'Hello! How can I assist you with your writing today?',
      isUser: false,
      role: 'assistant',
      timestamp: new Date(),
    },
  ])
  const [isResponding, setIsResponding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const handleSendMessage = async (content: string, entityRefs?: EntityReference[]) => {
    // Don't allow sending empty messages
    if (!content.trim()) return

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content,
      isUser: true,
      role: 'user',
      timestamp: new Date(),
      entityReferences: entityRefs,
    }

    setMessages(prev => [...prev, userMessage])
    setIsResponding(true)
    setError(null)

    // Create a new ID for the assistant message
    const assistantMessageId = `ai-${Date.now()}`

    // Initialize streaming message
    const streamingMessage: Message = {
      id: assistantMessageId,
      content: '',
      isUser: false,
      role: 'assistant',
      timestamp: new Date(),
      isStreaming: true,
    }

    // Add the initial empty assistant message
    setMessages(prev => [...prev, streamingMessage])

    try {
      // Format messages for API
      const apiMessages = messages
        .filter(msg => msg.id !== 'welcome') // Remove welcome message
        .concat(userMessage) // Add current user message
        .map(msg => ({
          role: msg.role,
          content: msg.content,
          entityReferences: msg.entityReferences, // Include entity references
        }))

      const payload = {
        messages: apiMessages,
        documentId,
        documentContext,
        model: 'gpt-4o', // Default model, could be made configurable
      }

      // Use the appropriate method based on environment
      if (isElectron) {
        // In Electron, use the electron API
        const result = await window.electronAPI.post('/dialogue/chat', payload)

        // For now, as a temporary solution until we implement real streaming in Electron
        // Just return the result as a complete message
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: result || "I couldn't process your request at this time.",
                  isStreaming: false,
                }
              : msg,
          ),
        )
        setIsResponding(false)
        return
      } else {
        // In the browser, use fetch directly for streaming instead of the post method from useAPI
        const res = await fetch('/api/dialogue/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          throw new Error(`API call failed with status: ${res.status}`)
        }

        if (!res.body) {
          throw new Error('No response body')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let responseText = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          responseText += chunk

          // Update the streaming message content
          setMessages(prev =>
            prev.map(msg => (msg.id === assistantMessageId ? { ...msg, content: responseText } : msg)),
          )
        }

        // Finalize the message (remove streaming flag)
        setMessages(prev =>
          prev.map(msg => (msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg)),
        )
      }
    } catch (err: any) {
      // Ignore aborted requests
      if (err.name === 'AbortError') return

      console.error('Chat API error:', err)
      setError(err.message || 'Failed to get response')
      toast.error(`Chat error: ${err.message || 'Unknown error'}`)

      // Remove the streaming message if it exists
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
    } finally {
      setIsResponding(false)
      abortControllerRef.current = null
    }
  }

  return (
    <motion.div
      animate={{
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateX(0%)' : 'translateX(5%)',
      }}
      transition={{
        duration: 0.3,
        ease: [0.23, 1, 0.32, 1],
      }}
      className={cn(
        'flex h-full w-full flex-col overflow-hidden bg-white/95 shadow-lg dark:bg-zinc-900/95',
        className,
      )}>
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="font-medium">Chat with AI{documentId ? ' - Document Assistant' : ''}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white/50 p-4 dark:bg-zinc-800/50">
        {messages.map(message => (
          <ChatMessage
            key={message.id}
            message={message.content}
            isUser={message.isUser}
            timestamp={message.timestamp}
            isStreaming={message.isStreaming}
            entityReferences={message.entityReferences}
          />
        ))}
        {isResponding && !messages.some(m => m.isStreaming) && (
          <div className="mb-4 flex w-max max-w-[80%] animate-pulse rounded-lg bg-muted px-4 py-2 text-muted-foreground">
            <div className="text-sm">•••</div>
          </div>
        )}
        {error && (
          <div className="mb-4 flex w-max max-w-[80%] rounded-lg bg-destructive/10 px-4 py-2 text-destructive">
            <div className="text-sm">Error: {error}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSendMessage={handleSendMessage} disabled={isResponding} />
    </motion.div>
  )
}
