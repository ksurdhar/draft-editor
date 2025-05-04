import { streamText, smoothStream } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import withHybridAuth, { ExtendedApiRequest } from '../../../lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { getProviderFromModel } from '@lib/constants'

// Create AI clients with API keys from environment
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
})

const anthropicAI = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Define message schema for validation
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  entityReferences: z
    .array(
      z.object({
        type: z.string(),
        id: z.string(),
        displayName: z.string(),
        parentId: z.string().optional(),
        parentType: z.string().optional(),
      }),
    )
    .optional(),
})

// Define request schema with all supported models
const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  documentContext: z.string().optional(),
  documentId: z.string().optional(),
  entityContents: z.record(z.any()).optional(),
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

    const { messages, documentContext, documentId, entityContents, model } = parsedRequest.data
    const provider = getProviderFromModel(model)

    // Log the user making the request
    console.log('\n=== Chat Completion Request ===')
    console.log('User ID:', user.sub)
    console.log('Model:', model)
    console.log('Provider:', provider)
    console.log('Document ID:', documentId || 'None')
    console.log('Messages count:', messages.length)
    console.log('Entity contents:', entityContents ? Object.keys(entityContents).length : 0)

    // Debug log the entity structure
    if (entityContents && Object.keys(entityContents).length > 0) {
      console.log('\nEntity content structure:')
      Object.entries(entityContents).forEach(([_key, entity]) => {
        console.log(`- Key: ${_key}`)
        console.log(`  Type: ${entity.type}`)
        console.log(`  Name: ${entity.name}`)

        // For conversations, check entries instead of content
        if (entity.type === 'conversation') {
          console.log(`  Has entries: ${!!(entity.entries && entity.entries.length > 0)}`)
          if (entity.entries && entity.entries.length > 0) {
            console.log(`  Entries count: ${entity.entries.length}`)
            console.log(`  First few entries: ${JSON.stringify(entity.entries.slice(0, 2))}`)
          }
        } else {
          console.log(`  Has content: ${!!entity.content}`)
          if (entity.content) {
            console.log(`  Content type: ${typeof entity.content}`)
          }
        }
      })
    }

    // Process entity references to create context
    let entityContext = ''
    if (entityContents && Object.keys(entityContents).length > 0) {
      entityContext = 'Referenced entities:\n\n'

      Object.entries(entityContents).forEach(([_key, entity]) => {
        entityContext += `--- ${entity.type.toUpperCase()}: ${entity.name} ---\n`

        if (entity.type === 'document' && entity.content) {
          // For documents, include the text representation of the content only
          try {
            const content = entity.content
            console.log(`Document content type: ${typeof content}`)

            // We expect content to be a string (plaintext)
            if (typeof content === 'string') {
              console.log(`Document content is text, length: ${content.length}`)
              entityContext += `Document content:\n${content}\n`
              console.log(`Added ${content.length} characters of text content for document`)
            } else {
              // Log error if not a string
              console.log(`Error: Document content is not a string but ${typeof content}`)
              entityContext += 'Error: Document content is not in expected text format\n'
            }
          } catch (e) {
            console.log(`Error processing document content: ${e}`)
            entityContext += 'Error processing document content\n'
          }
        } else if (entity.type === 'conversation') {
          // For conversations, use the precomputed text content
          if (entity.textContent && typeof entity.textContent === 'string') {
            console.log(`Using conversation text content: ${entity.textContent.length} characters`)
            entityContext += `Conversation dialogue:\n${entity.textContent}\n`
            console.log(`Added ${entity.textContent.length} characters of text for conversation`)
          }
          // Fall back to processing entries if needed
          else if (entity.entries && Array.isArray(entity.entries)) {
            console.log(`Processing conversation with ${entity.entries.length} entries`)
            const conversationName = entity.conversationName || entity.name || 'Unnamed'

            if (entity.entries.length > 0) {
              entityContext += `Conversation "${conversationName}" dialogue:\n`
              let totalConversationChars = 0
              entity.entries.forEach((entry: any, _i: number) => {
                const entryText = `${entry.character}: ${entry.text}\n`
                entityContext += entryText
                totalConversationChars += entryText.length
              })
              console.log(
                `Added ${entity.entries.length} conversation entries (${totalConversationChars} characters) to entityContext`,
              )
            } else {
              entityContext += `Conversation "${conversationName}" has no dialogue entries yet\n`
            }
          } else {
            entityContext += 'Conversation has no content\n'
          }
        } else if (entity.type === 'scene') {
          // Add scene handling when implemented
          entityContext += 'Scene content (not yet implemented)\n'
        }

        entityContext += '\n'
      })
    }

    console.log('Entity context:', entityContext)
    console.log(`Total entity context length: ${entityContext.length} characters`)

    // Add system message if not already present
    const processedMessages = [...messages]
    if (!processedMessages.some(m => m.role === 'system')) {
      const systemPrompt = `You are a helpful assistant for writers working on their books and documents.
      ${documentContext ? 'Here is context about the current document: ' + documentContext : ''}
      ${documentId ? 'The user is currently working on document ID: ' + documentId : ''}
      ${entityContext ? entityContext : ''}
      
      Provide thoughtful, creative, and helpful responses to assist the user with their writing.`

      processedMessages.unshift({
        role: 'system',
        content: systemPrompt.trim(),
      })
    } else if (entityContext) {
      // If there's already a system message but we have entity references,
      // update the system message to include the entity context
      const systemMessage = processedMessages.find(m => m.role === 'system')
      if (systemMessage) {
        systemMessage.content = `${systemMessage.content}\n\n${entityContext}`
      }
    }

    // Select the appropriate AI provider based on the model
    let aiModel
    switch (provider) {
      case 'google':
        aiModel = googleAI(model)
        break
      case 'anthropic':
        aiModel = anthropicAI(model)
        break
      case 'openai':
      default:
        aiModel = openai(model)
        break
    }

    // Use streamText with the selected AI model
    const result = await streamText({
      model: aiModel,
      messages: processedMessages as any, // Type assertion to avoid complex typings
      temperature: 0.7,
      maxTokens: 1000,
      experimental_transform: smoothStream({
        delayInMs: 20,
        chunking: 'word',
      }),
      onError: ({ error }) => {
        console.error('Streaming error:', error)
      },
    })

    // Log success
    console.log('Chat completion streaming started')

    // Pipe the text stream to the response instead of returning it
    result.pipeTextStreamToResponse(res)
    return
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
