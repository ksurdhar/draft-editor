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
import { flattenTiptapContent, conversationEntriesToText } from '@lib/tiptap-utils'
import { AI_MODELS } from '@lib/constants'

// Session storage key for the selected model
const SELECTED_MODEL_KEY = 'selected-chat-model'
const DEFAULT_MODEL_ID = 'gpt-4o' // Default model if none saved

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
  const { getEntityById, loadDocumentContent, loadConversationContent, loadFolderContent } = useEntities()
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
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID)
  const [hasModelInitialized, setHasModelInitialized] = useState(false)

  // Load selected model from session storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedModel = sessionStorage.getItem(SELECTED_MODEL_KEY)
      if (savedModel) {
        // Validate if the saved model ID is valid
        const isValidModel = Object.values(AI_MODELS).some(providerModels =>
          providerModels.some(model => model.id === savedModel),
        )
        if (isValidModel) {
          setSelectedModel(savedModel)
        } else {
          // If saved model is invalid, use default and clear storage
          console.warn(`Invalid saved model ID "${savedModel}". Using default.`)
          setSelectedModel(DEFAULT_MODEL_ID)
          sessionStorage.removeItem(SELECTED_MODEL_KEY)
        }
      } else {
        // If no model saved, set the default (already done in useState initial)
      }
      setHasModelInitialized(true) // Mark as initialized
    }
  }, [])

  // Save selected model to session storage when it changes
  useEffect(() => {
    // Only save after initial loading is complete
    if (typeof window !== 'undefined' && hasModelInitialized) {
      sessionStorage.setItem(SELECTED_MODEL_KEY, selectedModel)
    }
  }, [selectedModel, hasModelInitialized])

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
      if (ref.type === 'document') {
        const documentWithContent = await loadDocumentContent(ref.id)

        if (documentWithContent && documentWithContent.content) {
          // Convert TipTap JSON to plain text
          const plainTextContent = flattenTiptapContent(documentWithContent.content)
          console.log(`Document text extracted: ${plainTextContent.length} characters`)

          entityContents[`document:${ref.id}`] = {
            type: 'document',
            id: ref.id,
            name: ref.displayName,
            content: plainTextContent,
          }
        }
      } else if (ref.type === 'folder') {
        // Load all documents in this folder
        const documentsInFolder = await loadFolderContent(ref.id)
        console.log(`Found ${documentsInFolder.length} documents in folder ${ref.displayName}`)

        // Process each document in the folder
        for (const doc of documentsInFolder) {
          if (doc.content) {
            // Convert TipTap JSON to plain text
            const plainTextContent = flattenTiptapContent(doc.content)
            console.log(`Folder document text extracted: ${doc.name} - ${plainTextContent.length} characters`)

            // Store the document with a special key indicating it came from a folder
            entityContents[`document:${doc.id}:folder:${ref.id}`] = {
              type: 'document',
              id: doc.id,
              name: doc.name,
              folderRef: {
                id: ref.id,
                name: ref.displayName,
              },
              content: plainTextContent,
            }
          } else {
            console.log(`No content found for document ${doc.id} in folder ${ref.id}`)
          }
        }
      } else if (ref.type === 'conversation' && ref.parentId) {
        // Load conversation content using the EntityProvider
        const conversationWithContent = await loadConversationContent(ref.id)

        if (conversationWithContent) {
          // Generate plain text representation of conversation
          const plainTextConversation = conversationEntriesToText(conversationWithContent.entries || [])
          console.log(
            `Conversation text extracted: ${plainTextConversation.length} characters from ${conversationWithContent.entries?.length || 0} entries`,
          )

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
            // Add the plain text representation
            textContent: plainTextConversation,
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

      // Calculate and log total size of entity contents
      let totalTextSize = 0
      Object.values(entityContents).forEach((entity: any) => {
        if (entity.type === 'document' && typeof entity.content === 'string') {
          totalTextSize += entity.content.length
        } else if (entity.type === 'conversation') {
          if (entity.textContent) {
            totalTextSize += entity.textContent.length
          } else if (entity.entries && Array.isArray(entity.entries)) {
            totalTextSize += JSON.stringify(entity.entries).length
          }
        }
      })
      console.log(`Total entity content text size: ${totalTextSize} characters`)

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
        model: selectedModel, // Use the state variable
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
        const res = await fetch('/api/ai/chat', {
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

      <div className="max-h-[50vh] flex-shrink-0">
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={isResponding}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>
    </motion.div>
  )
}
