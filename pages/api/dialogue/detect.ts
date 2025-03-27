import { OpenAI } from 'openai'
import type { NextApiRequest, NextApiResponse } from 'next'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { text } = req.body

    if (!text) {
      return res.status(400).json({ error: 'No text provided' })
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a dialogue detection system. Analyze the provided text and identify dialogue sections.
          For each dialogue section, determine:
          1. The character speaking
          2. ONLY the exact dialogue text (the precise words spoken)
          3. A conversation ID to group related dialogue (use conv1, conv2, etc.)
          4. Your confidence in the character identification (0-1)
          
          IMPORTANT: For the dialogue snippet, include ONLY the exact words spoken by the character.
          Do NOT include any surrounding context, narration, or speaker attribution.
          For example, from the text: 'John said "Hello there!" with a smile'
          Return ONLY: "Hello there!" as the snippet.
          
          Return only valid JSON in the following format:
          {
            "dialogues": [
              {
                "character": "character name",
                "snippet": "exact dialogue text only",
                "confidence": 0.95,
                "conversationId": "conv1"
              }
            ]
          }
          
          If no dialogue is found, return: {"dialogues": []}`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    })

    const result = completion.choices[0].message.content
    if (!result) {
      return res.status(500).json({ error: 'No response from OpenAI' })
    }

    let parsed
    try {
      parsed = JSON.parse(result)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', result)
      return res.status(500).json({ error: 'Invalid JSON response from OpenAI' })
    }

    if (!parsed || !Array.isArray(parsed.dialogues)) {
      console.error('Invalid response structure:', parsed)
      return res.status(500).json({ error: 'Invalid response structure from OpenAI' })
    }

    // Validate each dialogue entry
    const dialogues = parsed.dialogues
      .map((dialogue: any) => {
        if (!dialogue.snippet || !dialogue.character || !dialogue.conversationId) {
          console.warn('Invalid dialogue entry:', dialogue)
          return null
        }
        return dialogue
      })
      .filter(Boolean) // Remove any null entries

    return res.status(200).json({ dialogues })
  } catch (error: any) {
    console.error('Dialogue detection error:', error)
    return res.status(500).json({
      error: error.message || 'Failed to detect dialogue',
      details: error.response?.data || error.toString(),
    })
  }
}
