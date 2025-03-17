import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'

export default withHybridAuth(async function dialogueEntryHandler(
  req: ExtendedApiRequest,
  res: NextApiResponse,
) {
  const { query, method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  const dialogueId = query.id?.toString() || ''

  switch (method) {
    case 'GET': {
      console.log('\n=== Getting Dialogue Entry ===')
      console.log('Dialogue ID:', dialogueId)

      const dialogueEntry = await storage.findById('dialogue', dialogueId)
      if (!dialogueEntry) {
        return res.status(404).json({ error: 'Dialogue entry not found' })
      }

      // Get the character to check ownership
      const characterId = dialogueEntry.characterId as string
      const character = await storage.findById('characters', characterId)
      if (!character) {
        return res.status(404).json({ error: 'Associated character not found' })
      }

      // Check if the user has permission to access this dialogue entry
      if (character.userId !== user.sub) {
        return res.status(403).json({ error: 'Access denied' })
      }

      res.status(200).json({
        ...dialogueEntry,
        id: dialogueEntry._id,
      })
      break
    }
    case 'PATCH': {
      console.log('\n=== Updating Dialogue Entry ===')
      console.log('Dialogue ID:', dialogueId)

      const dialogueEntry = await storage.findById('dialogue', dialogueId)
      if (!dialogueEntry) {
        return res.status(404).json({ error: 'Dialogue entry not found' })
      }

      // Get the character to check ownership
      const characterId = dialogueEntry.characterId as string
      const character = await storage.findById('characters', characterId)
      if (!character) {
        return res.status(404).json({ error: 'Associated character not found' })
      }

      // Check if the user has permission to update this dialogue entry
      if (character.userId !== user.sub) {
        return res.status(403).json({ error: 'Access denied' })
      }

      // Prepare update data
      const updateData = {
        ...req.body,
        lastUpdated: Date.now(),
      }

      // Ensure content is not removed
      if (updateData.content === '') {
        return res.status(400).json({ error: 'Dialogue content cannot be empty' })
      }

      const updatedDialogueEntry = await storage.update('dialogue', dialogueId, updateData)

      if (!updatedDialogueEntry) {
        return res.status(500).json({ error: 'Failed to update dialogue entry' })
      }

      res.status(200).json({
        ...updatedDialogueEntry,
        id: updatedDialogueEntry._id,
      })
      break
    }
    case 'DELETE': {
      console.log('\n=== Deleting Dialogue Entry ===')
      console.log('Dialogue ID:', dialogueId)

      const dialogueEntry = await storage.findById('dialogue', dialogueId)
      if (!dialogueEntry) {
        return res.status(404).json({ error: 'Dialogue entry not found' })
      }

      // Get the character to check ownership
      const characterId = dialogueEntry.characterId as string
      const character = await storage.findById('characters', characterId)
      if (!character) {
        return res.status(404).json({ error: 'Associated character not found' })
      }

      // Check if the user has permission to delete this dialogue entry
      if (character.userId !== user.sub) {
        return res.status(403).json({ error: 'Access denied' })
      }

      await storage.delete('dialogue', { _id: dialogueId })
      console.log('Dialogue entry deleted successfully')
      res.status(200).json({ success: true })
      break
    }
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})
