import { streamText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import withHybridAuth, { ExtendedApiRequest } from '../../../lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'

// Create OpenAI client with API key from environment
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Define message schema for validation
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
})

// Define request schema
const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  documentContext: z.string().optional(),
  documentId: z.string().optional(),
  model: z.string().default('gpt-4o'),
})

async function chatHandler(req: ExtendedApiRequest, res: NextApiResponse): Promise<void | Response> {
  const { method, user } = req

  if (!user) {
    // Log the auth failure with details
    console.error('Auth failed:', {
      headers: req.headers,
      method,
      url: req.url,
      timestamp: new Date().toISOString(),
    })
    res.status(401).end('Unauthorized')
    return
  }

  if (method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    // Validate request data
    const parsedRequest = ChatRequestSchema.safeParse(req.body)
    if (!parsedRequest.success) {
      res.status(400).json({
        error: 'Invalid request',
        details: parsedRequest.error.format(),
      })
      return
    }

    const { messages, documentContext, documentId, model } = parsedRequest.data

    // Log the user making the request
    console.log('\n=== Chat Completion Request ===')
    console.log('User ID:', user.sub)
    console.log('Model:', model)
    console.log('Document ID:', documentId || 'None')
    console.log('Messages count:', messages.length)

    // Add system message if not already present
    const processedMessages = [...messages]
    if (!processedMessages.some(m => m.role === 'system')) {
      const systemPrompt = `You are a helpful assistant for writers working on their books and documents.
      ${documentContext ? 'Here is context about the current document: ' + documentContext : ''}
      ${documentId ? 'The user is currently working on document ID: ' + documentId : ''}
      
      Provide thoughtful, creative, and helpful responses to assist the user with their writing.`

      processedMessages.unshift({
        role: 'system',
        content: systemPrompt.trim(),
      })
    }

    // Use streamText with the OpenAI model
    const result = await streamText({
      model: openai(model),
      messages: processedMessages as any, // Type assertion to avoid complex typings
      temperature: 0.7,
      maxTokens: 1000,
      onError: ({ error }) => {
        console.error('Streaming error:', error)
      },
    })

    // Log success
    console.log('Chat completion streaming started')

    // Return text stream response
    return result.toTextStreamResponse()
  } catch (error: any) {
    console.error('Chat completion error:', error)

    // Log the full error details
    console.error('API Error:', {
      error: error instanceof Error ? error.message : error,
      method,
      url: req.url,
      user: user.sub,
      timestamp: new Date().toISOString(),
    })

    // If headers have already been sent, we need to end the response
    if (res.headersSent) {
      res.end(`\n\nError: ${error.message || 'An error occurred during chat completion.'}`)
    } else {
      // Otherwise send a proper error response
      res.status(500).json({
        error: 'An error occurred during chat completion.',
        details: error.message, // Include error details
      })
    }
    return
  }
}

export default withHybridAuth(chatHandler)
