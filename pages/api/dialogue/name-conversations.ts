import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'

// Create OpenAI client with API key from environment
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Define the request schema using Zod
const ConversationNamingRequestSchema = z.object({
  conversations: z.array(
    z.object({
      id: z.string(),
      snippets: z.array(z.string().min(1)),
    }),
  ),
})

// Define the response schema using Zod
const ConversationNamingResponseSchema = z.object({
  names: z.array(
    z.object({
      id: z.string(),
      name: z.string().max(60),
      confidence: z.number(),
    }),
  ),
})

async function nameConversationsHandler(req: ExtendedApiRequest, res: NextApiResponse) {
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
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse and validate the request
    const { conversations } = ConversationNamingRequestSchema.parse(req.body)

    if (conversations.length === 0) {
      return res.status(200).json({ names: [] })
    }

    // Log the user making the request
    console.log('\n=== Naming Conversations ===')
    console.log('User ID:', user.sub)
    console.log('Conversations to name:', conversations.length)

    // Use generateObject with the defined schema
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      mode: 'json',
      schema: ConversationNamingResponseSchema,
      schemaName: 'ConversationNaming',
      schemaDescription: 'Generate descriptive names for conversations based on dialogue snippets.',
      messages: [
        {
          role: 'system',
          content: `Give each conversation a concise descriptive title (≤60 chars).`,
        },
        {
          role: 'user',
          content: JSON.stringify({ conversations }),
        },
      ],
      temperature: 0.3,
    })

    // Log success
    console.log('Conversation naming successful, named', object.names.length, 'conversations')

    // The 'object' is already validated against the schema
    return res.status(200).json(object)
  } catch (error: any) {
    console.error('Conversation naming error:', error)

    // Log the full error details
    console.error('API Error:', {
      error: error instanceof Error ? error.message : error,
      method,
      url: req.url,
      user: user.sub,
      timestamp: new Date().toISOString(),
    })

    // Provide a more generic error message, but log details
    let errorMessage = 'Failed to name conversations'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    // Send error response
    return res.status(500).json({
      error: 'An error occurred during conversation naming.',
      details: errorMessage,
    })
  }
}

export default withHybridAuth(nameConversationsHandler)
