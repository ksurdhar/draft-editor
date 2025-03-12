import { NextApiRequest, NextApiResponse } from 'next'
import { storage } from '@lib/storage'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid folder ID' })
  }

  switch (req.method) {
    case 'PUT':
    case 'PATCH':
      try {
        const updatedFolder = await storage.update('folders', id, {
          ...req.body,
          lastUpdated: Date.now(),
        })

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
        // First, check if there are any documents or folders in this folder
        const [docs, subfolders] = await Promise.all([
          storage.find('documents', { location: id } as Record<string, any>),
          storage.find('folders', { parentId: id } as Record<string, any>),
        ])

        if (docs.length > 0 || subfolders.length > 0) {
          return res.status(400).json({
            error: 'Cannot delete folder that contains documents or subfolders',
          })
        }

        const success = await storage.delete('folders', { _id: id } as Record<string, any>)
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
}
