import { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { computeEntityHash } from '../../../utils/computeEntityHash'

export default withHybridAuth(async function handler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  switch (req.method) {
    case 'GET':
      try {
        const { userId } = req.query
        // Allow querying only for the authenticated user
        const query = { userId: userId || user.sub }
        const folders = await storage.find('folders', query)
        res.status(200).json(folders)
      } catch (error) {
        console.error('Error fetching folders:', error)
        res.status(500).json({ error: 'Failed to fetch folders' })
      }
      break

    case 'POST':
      try {
        const { title, parentId, _id } = req.body
        if (!title) {
          return res.status(400).json({ error: 'Missing required fields' })
        }

        // Create the folder data
        const folderData: any = {
          title,
          parentId,
          userId: user.sub,
          lastUpdated: Date.now(),
          folderIndex: 0,
        }

        // If client supplied an _id, use it
        if (_id) {
          console.log('Using client-supplied ID for folder:', _id)
          folderData._id = _id
        }

        // If client supplied a hash, use it, otherwise generate one
        if (!req.body.hash) {
          folderData.hash = computeEntityHash(folderData)
          console.log('Generated hash for new folder:', folderData.hash)
        } else {
          folderData.hash = req.body.hash
          console.log('Using client-supplied hash:', folderData.hash)
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
})
