import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

// Create OpenAI client with API key from environment
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface DialogueDetectionResult {
  character: string
  confidence: number
  snippet: string
  conversationId: string
}

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

async function processTextChunk(text: string): Promise<DialogueDetectionResult[]> {
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o'),
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

    return object.dialogues
  } catch (e) {
    console.error('Failed to detect dialogue in chunk:', e)
    throw e
  }
}

export async function detectDialogue(text: string, chunkSize = 10000): Promise<DialogueDetectionResult[]> {
  try {
    // Split text into chunks if it's larger than the chunk size
    if (text.length <= chunkSize) {
      return await processTextChunk(text)
    }

    // Process large text in chunks
    const chunks: string[] = []
    let lastBreak = 0
    let currentChunkStart = 0

    // Try to split at sentence boundaries when possible
    for (let i = chunkSize; i < text.length; i += chunkSize) {
      // Look for the next period, question mark, or exclamation mark followed by a space or newline
      let breakPoint = text.slice(i - 100, i + 100).search(/[.!?]\s/)
      if (breakPoint === -1) {
        // If no sentence boundary found, look for the next space
        breakPoint = text.slice(i - 50, i + 50).search(/\s/)
      }

      if (breakPoint !== -1) {
        // Add the offset to get the actual position in the text
        breakPoint += breakPoint === -1 ? i : i - 100
        chunks.push(text.slice(currentChunkStart, breakPoint + 1))
        currentChunkStart = breakPoint + 1
        lastBreak = breakPoint + 1
      }
    }

    // Add the remaining text as the last chunk
    if (lastBreak < text.length) {
      chunks.push(text.slice(lastBreak))
    }

    // Process all chunks in parallel
    const results = await Promise.all(chunks.map(chunk => processTextChunk(chunk)))

    // Combine results
    return results.flat()
  } catch (e) {
    console.error('Failed to detect dialogue:', e)
    throw e
  }
}

// Helper method to process text in chunks if needed
export async function processLargeText(text: string, chunkSize = 4000): Promise<DialogueDetectionResult[]> {
  const chunks = []
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize))
  }

  const results = await Promise.all(chunks.map(chunk => detectDialogue(chunk)))
  return results.flat()
}
