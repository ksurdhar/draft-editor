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

// Define request schema
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

    // Log the user making the request
    console.log('\n=== Chat Completion Request ===')
    console.log('User ID:', user.sub)
    console.log('Model:', model)
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
            if (entity.type === 'document') {
              console.log(`  Document content keys: ${Object.keys(entity.content || {}).join(', ')}`)
            }
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
          // For documents, include a text representation of the content
          try {
            const content = entity.content
            console.log(`Document content type: ${typeof content}`)

            // Handle different content formats
            if (typeof content === 'object') {
              console.log(`Document content has these keys: ${Object.keys(content)}`)

              // Try to extract meaningful content from document structure
              if (content.type === 'doc' && content.content) {
                console.log(`Document has ProseMirror structure with ${content.content.length} nodes`)
                // Extract text content from ProseMirror structure
                let docText = ''
                const extractText = (nodes: any[]) => {
                  nodes.forEach(node => {
                    if (node.type === 'text') {
                      docText += node.text + ' '
                    } else if (node.content && Array.isArray(node.content)) {
                      extractText(node.content)
                    }
                  })
                }

                try {
                  if (Array.isArray(content.content)) {
                    extractText(content.content)
                    console.log(`Extracted ${docText.length} characters of text`)
                    entityContext += `Document content:\n${docText.substring(0, 2000)}...\n`
                  } else {
                    entityContext += `Document content: ${JSON.stringify(content).substring(0, 1000)}...\n`
                  }
                } catch (err) {
                  console.log(`Error extracting text: ${err}`)
                  entityContext += `Document content: ${JSON.stringify(content).substring(0, 1000)}...\n`
                }
              } else {
                entityContext += `Document content: ${JSON.stringify(content).substring(0, 1000)}...\n`
              }
            } else if (typeof content === 'string') {
              console.log(`Document content is string, length: ${content.length}`)

              // Try to parse JSON string
              try {
                const parsedContent = JSON.parse(content)
                if (parsedContent.type === 'doc') {
                  console.log(`String content contains ProseMirror document`)
                }
                entityContext += `Document content: ${content.substring(0, 1000)}...\n`
              } catch (e) {
                entityContext += `Document content: ${content.substring(0, 1000)}...\n`
              }
            }
          } catch (e) {
            console.log(`Error processing document content: ${e}`)
            entityContext += 'Error processing document content\n'
          }
        } else if (entity.type === 'conversation') {
          // For conversations, include the entries
          try {
            if (entity.entries && Array.isArray(entity.entries)) {
              console.log(`Processing conversation with ${entity.entries.length} entries`)
              const conversationName = entity.conversationName || entity.name || 'Unnamed'

              if (entity.entries.length > 0) {
                entityContext += `Conversation "${conversationName}" dialogue:\n`
                entity.entries.forEach((entry: any, i: number) => {
                  if (i < 20) {
                    // Limit to first 20 entries to avoid context bloat
                    entityContext += `${entry.character}: ${entry.text}\n`
                  }
                })
                if (entity.entries.length > 20) {
                  entityContext += `... and ${entity.entries.length - 20} more entries\n`
                }
              } else {
                entityContext += `Conversation "${conversationName}" has no dialogue entries yet\n`
              }
            } else {
              entityContext += 'Conversation has no entries\n'
            }
          } catch (e) {
            console.log(`Error processing conversation: ${e}`)
            entityContext += 'Error processing conversation content\n'
          }
        } else if (entity.type === 'scene') {
          // Add scene handling when implemented
          entityContext += 'Scene content (not yet implemented)\n'
        }

        entityContext += '\n'
      })
    }

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
