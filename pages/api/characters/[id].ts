import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'

export default withHybridAuth(async function characterHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { query, method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  const characterId = query.id?.toString() || ''

  switch (method) {
    case 'GET': {
      console.log('\n=== Getting Character ===')
      console.log('Character ID:', characterId)

      const character = await storage.findById('characters', characterId)
      if (!character) {
        return res.status(404).json({ error: 'Character not found' })
      }

      // Check if the user has permission to access this character
      if (character.userId !== user.sub) {
        return res.status(403).json({ error: 'Access denied' })
      }

      res.status(200).json({
        ...character,
        id: character._id,
      })
      break
    }
    case 'PATCH': {
      console.log('\n=== Updating Character ===')
      console.log('Character ID:', characterId)

      const character = await storage.findById('characters', characterId)
      if (!character) {
        return res.status(404).json({ error: 'Character not found' })
      }

      // Check if the user has permission to update this character
      if (character.userId !== user.sub) {
        return res.status(403).json({ error: 'Access denied' })
      }

      // Prepare update data
      const updateData = {
        ...req.body,
        lastUpdated: Date.now(),
      }

      // Ensure name is not removed
      if (updateData.name === '') {
        return res.status(400).json({ error: 'Character name cannot be empty' })
      }

      const updatedCharacter = await storage.update('characters', characterId, updateData)

      if (!updatedCharacter) {
        return res.status(500).json({ error: 'Failed to update character' })
      }

      res.status(200).json({
        ...updatedCharacter,
        id: updatedCharacter._id,
      })
      break
    }
    case 'DELETE': {
      console.log('\n=== Deleting Character ===')
      console.log('Character ID:', characterId)

      const character = await storage.findById('characters', characterId)
      if (!character) {
        return res.status(404).json({ error: 'Character not found' })
      }

      // Check if the user has permission to delete this character
      if (character.userId !== user.sub) {
        return res.status(403).json({ error: 'Access denied' })
      }

      await storage.delete('characters', { _id: characterId, userId: user.sub })
      console.log('Character deleted successfully')
      res.status(200).json({ success: true })
      break
    }
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})
