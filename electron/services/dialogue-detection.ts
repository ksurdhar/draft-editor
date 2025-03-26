import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

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

export async function detectDialogue(text: string): Promise<DialogueDetectionResult[]> {
  try {
    const { object } = await generateObject({
      model: openai('gpt-4'),
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
