import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import { ObjectId } from 'mongodb'
import crypto from 'crypto'

const handlers = {
  async POST(req: ExtendedApiRequest, res: NextApiResponse) {
    console.log('\n=== Creating New Dialogue Entry ===')

    const now = Date.now()

    // Prepare dialogue entry data
    const dialogueData = {
      ...req.body,
      lastUpdated: now,
      isValid: true,
    }

    // If client supplied an _id, use it, otherwise generate one
    if (req.body._id) {
      console.log('Using client-supplied ID:', req.body._id)
      dialogueData._id = req.body._id
    } else {
      dialogueData._id = new ObjectId().toString()
    }

    // Ensure required fields are present
    if (!dialogueData.characterId) {
      return res.status(400).json({ error: 'Character ID is required' })
    }

    if (!dialogueData.documentId) {
      return res.status(400).json({ error: 'Document ID is required' })
    }

    if (!dialogueData.content) {
      return res.status(400).json({ error: 'Dialogue content is required' })
    }

    // Verify the character exists and belongs to the user
    const character = await storage.findById('characters', dialogueData.characterId)
    if (!character) {
      return res.status(404).json({ error: 'Character not found' })
    }

    if (character.userId !== req.user!.sub) {
      return res.status(403).json({ error: 'Access denied to this character' })
    }

    // Verify the document exists and belongs to the user
    const document = await storage.findById('documents', dialogueData.documentId)
    if (!document) {
      return res.status(404).json({ error: 'Document not found' })
    }

    if (document.userId !== req.user!.sub) {
      return res.status(403).json({ error: 'Access denied to this document' })
    }

    // Set character name from the character record
    dialogueData.characterName = character.name

    // Set document title from the document record
    dialogueData.documentTitle = document.title

    // Generate a hash for the paragraph content if provided
    if (dialogueData.location && dialogueData.location.paragraphContent) {
      dialogueData.location.paragraphHash = crypto
        .createHash('md5')
        .update(dialogueData.location.paragraphContent)
        .digest('hex')

      // Remove the full paragraph content from storage to save space
      delete dialogueData.location.paragraphContent
    }

    const newDialogueEntry = await storage.create('dialogueEntries', dialogueData)

    console.log('Dialogue entry created:', newDialogueEntry._id)

    // Update the character's documentIds array if not already included
    const documentIds = Array.isArray(character.documentIds) ? character.documentIds : []
    const docId = dialogueData.documentId as string // We've already checked it exists above
    if (!documentIds.includes(docId)) {
      const updatedDocumentIds = [...documentIds, docId]
      const characterId = character._id as string
      await storage.update('characters', characterId, { documentIds: updatedDocumentIds })
      console.log('Updated character document IDs')
    }

    res.status(200).json({
      ...newDialogueEntry,
      id: newDialogueEntry._id,
    })
  },

  async GET(req: ExtendedApiRequest, res: NextApiResponse) {
    console.log('\n=== Fetching Dialogue Entries ===')
    console.log('User ID:', req.user!.sub)

    // Get query parameters
    const { characterId, documentId, validOnly } = req.query

    // Build query
    const query: any = {}

    // Filter by character ID if provided
    if (characterId) {
      query.characterId = characterId
    }

    // Filter by document ID if provided
    if (documentId) {
      query.documentId = documentId
    }

    // Only include valid entries if requested
    if (validOnly === 'true') {
      query.isValid = true
    }

    // Get all characters belonging to the user
    const userCharacters = await storage.find('characters', { userId: req.user!.sub })
    const userCharacterIds = userCharacters.map(char => char._id)

    // Ensure we only return dialogue for characters owned by the user
    query.characterId = { $in: userCharacterIds }

    const dialogueEntries = await storage.find('dialogueEntries', query)
    console.log('Found dialogue entries:', dialogueEntries.length)

    // Process dialogue entries
    const processedEntries = dialogueEntries.map(entry => ({
      ...entry,
      id: entry._id,
    }))

    res.status(200).json(processedEntries)
  },
}

export default withHybridAuth(async function dialogueHandler(req: ExtendedApiRequest, res: NextApiResponse) {
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
