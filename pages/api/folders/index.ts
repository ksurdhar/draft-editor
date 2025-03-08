import { NextApiRequest, NextApiResponse } from 'next'
import { storage } from '@lib/storage'

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
        const { title, parentId, userId, _id } = req.body
        if (!title || !userId) {
          return res.status(400).json({ error: 'Missing required fields' })
        }

        // Create the folder data
        const folderData: any = {
          title,
          parentId,
          userId,
          lastUpdated: Date.now(),
          folderIndex: 0
        }
        
        // If client supplied an _id, use it
        if (_id) {
          console.log('Using client-supplied ID for folder:', _id)
          folderData._id = _id
        }

        const newFolder = await storage.create('folders', folderData)
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