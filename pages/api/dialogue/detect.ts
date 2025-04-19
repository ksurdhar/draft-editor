import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'

// Create OpenAI client with API key from environment
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Define the expected response schema using Zod
const DialogueResponseSchema = z.object({
  dialogues: z.array(
    z.object({
      character: z.string(),
      confidence: z.number(),
      snippet: z.string(),
      conversationId: z.string(),
    }),
  ),
})

async function dialogueDetectionHandler(req: ExtendedApiRequest, res: NextApiResponse) {
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
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: 'No text provided' })
    }

    // Log the user making the request
    console.log('\n=== Detecting Dialogue ===')
    console.log('User ID:', user.sub)
    console.log('Text length:', text.length, 'characters')

    // Use generateObject with the defined schema
    const { object } = await generateObject({
      model: openai('gpt-4o'), // Using gpt-4o as in the electron service
      mode: 'json',
      schema: DialogueResponseSchema,
      schemaName: 'DialogueDetection',
      schemaDescription:
        'Detect dialogue sections in text with character and conversation identification. Return the exact dialogue text without any surrounding context.',
      messages: [
        {
          role: 'system',
          content: `You are a dialogue detection system. Analyze the provided text and identify dialogue sections.
          For each dialogue section:
          1. Determine the character speaking
          2. Extract ONLY the exact dialogue text (the precise words spoken, without any surrounding context or narration)
          3. Assign a conversation ID to group related dialogue together
          4. Assess your confidence in the character identification (0-1)

          Group dialogue into conversations based on:
          - Proximity of dialogue segments
          - Character interactions
          - Natural breaks in conversation (scene changes, etc.)

          Use incrementing conversation IDs (conv1, conv2, etc.) for different conversations.
          Keep the same conversation ID for back-and-forth dialogue between characters.

          IMPORTANT: For the dialogue snippet, include ONLY the exact words spoken by the character.
          Do NOT include any surrounding context, narration, or speaker attribution.
          For example, from the text: 'John said "Hello there!" with a smile'
          Return ONLY: "Hello there!" as the snippet.

          *** VERY IMPORTANT RULE ***
          If a single character's speech is interrupted by narration (e.g., "Go away," he said, "now."), you MUST return TWO SEPARATE dialogue objects for that speech turn.
          - The first object's snippet would be "Go away,"
          - The second object's snippet would be "now."
          - Both objects should have the same character and conversationId.
          DO NOT combine interrupted dialogue into a single snippet. Always split it based on the interruption.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.1,
    })

    // Log success
    console.log('Dialogue detection successful, found', object.dialogues.length, 'dialogues')

    // The 'object' is already validated against the schema
    return res.status(200).json(object)
  } catch (error: any) {
    console.error('Dialogue detection error:', error)

    // Log the full error details
    console.error('API Error:', {
      error: error instanceof Error ? error.message : error,
      method,
      url: req.url,
      user: user.sub,
      timestamp: new Date().toISOString(),
    })

    // Provide a more generic error message, but log details
    let errorMessage = 'Failed to detect dialogue'
    if (error instanceof Error) {
      errorMessage = error.message
    }

    // Check for specific AI SDK related errors if needed, otherwise send generic message
    return res.status(500).json({
      error: 'An error occurred during dialogue detection.',
      details: errorMessage, // Optionally include more detail in non-production environments
    })
  }
}

export default withHybridAuth(dialogueDetectionHandler)
