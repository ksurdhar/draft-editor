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
  text: string
  startIndex: number
  endIndex: number
  context?: string
}

const DialogueResponseSchema = z.object({
  dialogues: z.array(
    z.object({
      character: z.string(),
      confidence: z.number(),
      text: z.string(),
      context: z.string().optional(),
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
      schemaDescription: 'Detect dialogue sections in text with character identification',
      messages: [
        {
          role: 'system',
          content: `You are a dialogue detection system. Analyze the provided text and identify dialogue sections.
          For each dialogue section, determine:
          1. The character speaking
          2. The exact dialogue text
          3. The context around the dialogue (up to 50 characters before and after)
          4. Your confidence in the character identification (0-1)`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.1,
    })

    // Add start and end indices for each dialogue
    return object.dialogues.map(dialogue => ({
      ...dialogue,
      startIndex: text.indexOf(dialogue.text),
      endIndex: text.indexOf(dialogue.text) + dialogue.text.length,
    }))
  } catch (e) {
    console.error('Failed to detect dialogue in chunk:', e)
    throw e
  }
}

export async function detectDialogue(text: string, chunkSize = 4000): Promise<DialogueDetectionResult[]> {
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

    // Combine results and adjust indices based on chunk positions
    let offset = 0
    return results.flatMap((chunkResults, index) => {
      const adjustedResults = chunkResults.map(result => ({
        ...result,
        startIndex: result.startIndex + offset,
        endIndex: result.endIndex + offset,
      }))
      offset += chunks[index].length
      return adjustedResults
    })
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
