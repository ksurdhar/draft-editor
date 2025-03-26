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
          2. The exact dialogue text
          3. The context around the dialogue (up to 50 characters before and after)
          4. Your confidence in the character identification (0-1)
          
          Return only valid JSON in the following format:
          {
            "dialogues": [
              {
                "character": "character name",
                "text": "exact dialogue text",
                "confidence": 0.95,
                "context": "surrounding context"
              }
            ]
          }`,
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
      throw new Error('No response from OpenAI')
    }

    const parsed = JSON.parse(result)

    // Add start and end indices for each dialogue
    const dialogues = parsed.dialogues.map((dialogue: any) => ({
      ...dialogue,
      startIndex: text.indexOf(dialogue.text),
      endIndex: text.indexOf(dialogue.text) + dialogue.text.length,
    }))

    return res.status(200).json({ dialogues })
  } catch (error: any) {
    console.error('Dialogue detection error:', error)
    return res.status(500).json({
      error: error.message || 'Failed to detect dialogue',
    })
  }
}
