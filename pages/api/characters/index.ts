import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import { ObjectId } from 'mongodb'

const handlers = {
  async POST(req: ExtendedApiRequest, res: NextApiResponse) {
    console.log('\n=== Creating New Character ===')

    const now = Date.now()

    // Prepare character data
    const characterData = {
      ...req.body,
      userId: req.user!.sub,
      lastUpdated: now,
    }

    // If client supplied an _id, use it, otherwise generate one
    if (req.body._id) {
      console.log('Using client-supplied ID:', req.body._id)
      characterData._id = req.body._id
    } else {
      characterData._id = new ObjectId().toString()
    }

    // Ensure required fields are present
    if (!characterData.name) {
      return res.status(400).json({ error: 'Character name is required' })
    }

    // Set default values for optional fields if not provided
    characterData.motivation = characterData.motivation || ''
    characterData.description = characterData.description || ''
    characterData.traits = characterData.traits || []
    characterData.relationships = characterData.relationships || []
    characterData.documentIds = characterData.documentIds || []
    characterData.isArchived = characterData.isArchived || false

    const newCharacter = await storage.create('characters', characterData)

    console.log('Character created:', newCharacter._id)

    res.status(200).json({
      ...newCharacter,
      id: newCharacter._id,
    })
  },

  async GET(req: ExtendedApiRequest, res: NextApiResponse) {
    console.log('\n=== Fetching Characters ===')
    console.log('User ID:', req.user!.sub)

    // Get query parameters
    const { documentId, includeArchived } = req.query

    // Build query
    const query: any = { userId: req.user!.sub }

    // Filter by document ID if provided
    if (documentId) {
      query.documentIds = documentId
    }

    // Exclude archived characters unless explicitly requested
    if (includeArchived !== 'true') {
      query.isArchived = { $ne: true }
    }

    const characters = await storage.find('characters', query)
    console.log('Found characters:', characters.length)

    // Process characters
    const processedCharacters = characters.map(char => ({
      ...char,
      id: char._id,
    }))

    res.status(200).json(processedCharacters)
  },
}

export default withHybridAuth(async function charactersHandler(
  req: ExtendedApiRequest,
  res: NextApiResponse,
) {
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

  const handler = handlers[method as keyof typeof handlers]

  if (!handler) {
    res.setHeader('Allow', Object.keys(handlers))
    res.status(405).end(`Method ${method} Not Allowed`)
    return
  }

  try {
    await handler(req, res)
  } catch (error) {
    // Log the full error details
    console.error('API Error:', {
      error: error instanceof Error ? error.message : error,
      method,
      url: req.url,
      user: user.sub,
      timestamp: new Date().toISOString(),
    })
    res.status(500).end('Internal Server Error')
  }
})
