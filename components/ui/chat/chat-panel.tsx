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
  const { getEntityById, loadDocumentContent, loadConversationContent } = useEntities()
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

  // Set up IPC listener for streaming in Electron
  useEffect(() => {
    if (!isElectron) return

    // Function to handle stream chunks from the main process
    const handleStreamChunk = (data: {
      messageId: string
      chunk?: string
      error?: string
      done: boolean
      fullText?: string
    }) => {
      const { messageId, chunk, error: streamError, done, fullText } = data

      if (streamError) {
        setError(streamError)
        toast.error(`Chat error: ${streamError}`)

        // Remove the streaming message if there was an error
        setMessages(prev => prev.filter(msg => msg.id !== messageId))
        setIsResponding(false)
        return
      }

      if (done) {
        // Mark message as no longer streaming when we're done
        setMessages(prev => prev.map(msg => (msg.id === messageId ? { ...msg, isStreaming: false } : msg)))
        setIsResponding(false)

        // If a fullText is provided and different from what we built up,
        // use it as a fallback to ensure consistency
        if (fullText) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === messageId && msg.content !== fullText ? { ...msg, content: fullText } : msg,
            ),
          )
        }
      } else if (chunk) {
        // Add the chunk to the message content
        setMessages(prev =>
          prev.map(msg => (msg.id === messageId ? { ...msg, content: msg.content + chunk } : msg)),
        )
      }
    }

    // Use the electronAPI.onChatStream method from preload
    const unsubscribe = window.electronAPI.onChatStream(handleStreamChunk)

    // Clean up the listener when component unmounts
    return () => {
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [])

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

  // Prepare entity contents for API
  const prepareEntityContents = async (entityRefs?: EntityReference[]) => {
    if (!entityRefs || entityRefs.length === 0) return {}

    const entityContents: Record<string, any> = {}

    // Process references sequentially to allow for async operations
    for (const ref of entityRefs) {
      //   console.log(`Processing entity reference: ${ref.type}:${ref.id} (${ref.displayName})`)

      if (ref.type === 'document') {
        // Load document content using the EntityProvider
        const documentWithContent = await loadDocumentContent(ref.id)
        // console.log(`Document content loaded:`, documentWithContent?.content ? 'success' : 'failed')

        if (documentWithContent && documentWithContent.content) {
          entityContents[`document:${ref.id}`] = {
            type: 'document',
            id: ref.id,
            name: ref.displayName,
            content: documentWithContent.content,
          }
          //   console.log(
          //     `Added document content to entity contents, type:`,
          //     typeof documentWithContent.content,
          //     `keys:`,
          //     Object.keys(documentWithContent.content || {}).join(', '),
          //   )
        }
      } else if (ref.type === 'conversation' && ref.parentId) {
        // Load conversation content using the EntityProvider
        const conversationWithContent = await loadConversationContent(ref.id)
        // console.log(
        //   `Conversation content loaded:`,
        //   conversationWithContent?.entries?.length
        //     ? `with ${conversationWithContent.entries.length} entries`
        //     : 'failed',
        // )

        if (conversationWithContent) {
          // Log detailed information about the conversation entity
          //   console.log(`Adding conversation entity to contents:`, {
          //     id: conversationWithContent.id,
          //     name: conversationWithContent.name,
          //     entriesCount: conversationWithContent.entries?.length || 0,
          //     hasEntries: !!(conversationWithContent.entries && conversationWithContent.entries.length > 0),
          //   })

          entityContents[`conversation:${ref.id}`] = {
            type: 'conversation',
            id: ref.id,
            name: ref.displayName,
            parentId: ref.parentId,
            parentType: ref.parentType,
            conversationId: conversationWithContent.conversationId,
            entries: conversationWithContent.entries || [],
            conversationName: conversationWithContent.conversationName || ref.displayName,
            documentTitle: conversationWithContent.documentTitle,
          }

          // Log the first few entries if available
          if (conversationWithContent.entries && conversationWithContent.entries.length > 0) {
            console.log(
              `First few entries:`,
              conversationWithContent.entries
                .slice(0, 2)
                .map(entry => `${entry.character}: ${entry.text.substring(0, 20)}...`),
            )
          }
        }
      } else if (ref.type === 'scene') {
        // Get scene entity
        const entity = getEntityById('scene', ref.id)
        // console.log(`Found scene entity:`, entity ? 'yes' : 'no')
        if (entity) {
          entityContents[`scene:${ref.id}`] = {
            type: 'scene',
            id: ref.id,
            name: ref.displayName,
            parentId: ref.parentId,
            parentType: ref.parentType,
            content: entity,
          }
        }
      }
    }

    // console.log(`Prepared entity contents for ${Object.keys(entityContents).length} entities`)
    return entityContents
  }

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
      // Prepare entity contents if there are entity references
      const entityContents = await prepareEntityContents(entityRefs)
      console.log('****SENDING ENTITY CONTENTS:', entityContents)
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
        entityContents, // Add entity contents to the payload
        model: 'gpt-4o', // Default model, could be made configurable
        messageId: assistantMessageId, // Pass the message ID for streaming
      }

      // Use the appropriate method based on environment
      if (isElectron) {
        // In Electron, use the dedicated streamChat method for streaming
        try {
          await window.electronAPI.streamChat(payload)
          // The streaming updates will be handled by the IPC listener in useEffect
          // No need to update message state here
        } catch (err: any) {
          console.error('Failed to initiate chat streaming:', err)
          setError(err.message || 'Failed to initiate chat streaming')
          toast.error(`Chat error: ${err.message || 'Unknown error'}`)

          // Remove the streaming message if we couldn't start streaming
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
          setIsResponding(false)
        }
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
        setIsResponding(false)
      }
    } catch (err: any) {
      // Ignore aborted requests
      if (err.name === 'AbortError') return

      console.error('Chat API error:', err)
      setError(err.message || 'Failed to get response')
      toast.error(`Chat error: ${err.message || 'Unknown error'}`)

      // Remove the streaming message if it exists
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
      setIsResponding(false)
    } finally {
      abortControllerRef.current = null
      // Don't set isResponding to false here for Electron, as the IPC listener handles it
      // It's only set to false for web or on error
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
