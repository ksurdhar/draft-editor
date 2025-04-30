import { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { computeEntityHash } from '../../../utils/computeEntityHash'

export default withHybridAuth(async function handler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { user } = req
  const { id } = req.query

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid folder ID' })
  }

  switch (req.method) {
    case 'PUT':
    case 'PATCH':
      try {
        // First verify the folder belongs to the user
        const folders = await storage.find('folders', { _id: id })
        const folder = folders[0]
        if (!folder || folder.userId !== user.sub) {
          return res.status(404).json({ error: 'Folder not found' })
        }

        const updateData = {
          ...req.body,
          userId: user.sub, // Ensure userId cannot be changed
          lastUpdated: Date.now(),
        }

        // If client supplied a hash, use it, otherwise generate one
        if (!updateData.hash) {
          // Create a merged version of the folder to generate a hash
          const mergedFolder = { ...folder, ...updateData }
          updateData.hash = computeEntityHash(mergedFolder)
          console.log('Generated hash for updated folder:', updateData.hash)
        } else {
          console.log('Using client-supplied hash:', updateData.hash)
        }

        const updatedFolder = await storage.update('folders', id, updateData)

        if (!updatedFolder) {
          return res.status(404).json({ error: 'Folder not found' })
        }

        res.status(200).json(updatedFolder)
      } catch (error) {
        console.error('Error updating folder:', error)
        res.status(500).json({ error: 'Failed to update folder' })
      }
      break

    case 'DELETE':
      try {
        // First verify the folder belongs to the user
        const folders = await storage.find('folders', { _id: id })
        const folder = folders[0]
        if (!folder || folder.userId !== user.sub) {
          return res.status(404).json({ error: 'Folder not found' })
        }

        // Check if there are any documents or folders in this folder
        const [docs, subfolders] = await Promise.all([
          storage.find('documents', { parentId: id }),
          storage.find('folders', { parentId: id }),
        ])

        if (docs.length > 0 || subfolders.length > 0) {
          return res.status(400).json({
            error: 'Cannot delete folder that contains documents or subfolders',
          })
        }

        const success = await storage.delete('folders', { _id: id, userId: user.sub })
        if (!success) {
          return res.status(404).json({ error: 'Folder not found' })
        }

        res.status(204).end()
      } catch (error) {
        console.error('Error deleting folder:', error)
        res.status(500).json({ error: 'Failed to delete folder' })
      }
      break

    default:
      res.setHeader('Allow', ['PUT', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${req.method} Not Allowed`)
  }
})
