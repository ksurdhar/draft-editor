import { NextApiRequest, NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import { FolderData } from '@typez/globals'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  switch (req.method) {
    case 'GET':
      try {
        const { userId } = req.query
        const query = userId ? { userId } : {}
        const folders = await storage.find('folders', query)
        res.status(200).json(folders)
      } catch (error) {
        console.error('Error fetching folders:', error)
        res.status(500).json({ error: 'Failed to fetch folders' })
      }
      break

    case 'POST':
      try {
        const { title, parentId, userId } = req.body
        if (!title || !userId) {
          return res.status(400).json({ error: 'Missing required fields' })
        }

        const folder: Omit<FolderData, 'id'> = {
          _id: '',
          title,
          parentId,
          userId,
          lastUpdated: Date.now(),
          folderIndex: 0
        }

        const newFolder = await storage.create('folders', folder)
        res.status(201).json(newFolder)
      } catch (error) {
        console.error('Error creating folder:', error)
        res.status(500).json({ error: 'Failed to create folder' })
      }
      break

    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${req.method} Not Allowed`)
  }
} 