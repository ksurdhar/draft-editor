'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@components/ui/button'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { cn } from '@components/lib/utils'

type Message = {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

const MOCK_RESPONSES = [
  "I'm an AI assistant here to help you. What can I do for you?",
  "That's an interesting question. Let me think about that...",
  "I'd be happy to help you with that task.",
  "I don't have all the information to answer that completely, but here's what I know.",
  'Let me provide some more details on that topic.',
  "That's a great point! I hadn't considered that perspective.",
]

type ChatPanelProps = {
  isOpen: boolean
  onClose: () => void
  className?: string
}

export function ChatPanel({ isOpen, onClose, className }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      content: 'Hello! How can I assist you today?',
      isUser: false,
      timestamp: new Date(),
    },
  ])
  const [isResponding, setIsResponding] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsResponding(true)

    // Simulate AI response after a delay
    setTimeout(
      () => {
        const randomResponse = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          content: randomResponse,
          isUser: false,
          timestamp: new Date(),
        }

        setMessages(prev => [...prev, aiMessage])
        setIsResponding(false)
      },
      1000 + Math.random() * 1000,
    ) // Random delay between 1-2 seconds
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
        <h3 className="font-medium">Chat with AI</h3>
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
          />
        ))}
        {isResponding && (
          <div className="mb-4 flex w-max max-w-[80%] animate-pulse rounded-lg bg-muted px-4 py-2 text-muted-foreground">
            <div className="text-sm">•••</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSendMessage={handleSendMessage} disabled={isResponding} />
    </motion.div>
  )
}
