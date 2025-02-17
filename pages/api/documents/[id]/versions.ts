import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { createVersion, getVersionsForDoc, getDocument, deleteVersion } from '@lib/mongo-utils'
import { VersionData } from '@typez/globals'

export default withHybridAuth(async function versionsHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { query, method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  const documentId = query.id?.toString() || ''
  const versionId = query.versionId?.toString()

  // Check document ownership
  const document = await getDocument(documentId)
  if (!document) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (document.userId !== user.sub) {
    res.status(403).json({ error: 'Not authorized to access this document' })
    return
  }

  switch (method) {
    case 'GET':
      try {
        const versions = await getVersionsForDoc(documentId)
        res.status(200).json(versions)
      } catch (error) {
        console.error('Error fetching versions:', error)
        res.status(500).json({ error: 'Failed to fetch versions' })
      }
      break

    case 'POST':
      try {
        if (!req.body) {
          res.status(400).json({ error: 'Request body is required' })
          return
        }

        if (!req.body.content) {
          res.status(400).json({ error: 'Content is required' })
          return
        }

        console.log('Creating version with data:', {
          documentId,
          ownerId: user.sub,
          content: typeof req.body.content === 'object' ? 'JSON content (object)' : 'String content'
        })

        const newVersion = await createVersion({
          documentId,
          ownerId: user.sub,
          content: req.body.content,
          createdAt: req.body.createdAt || Date.now(),
          name: req.body.name || ''
        })
        
        console.log('Version created successfully:', newVersion.id)
        res.status(200).json(newVersion)
      } catch (error) {
        console.error('Error creating version:', error)
        res.status(500).json({ 
          error: 'Failed to create version',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      break

    case 'DELETE':
      if (!versionId) {
        res.status(400).json({ error: 'Version ID is required' })
        return
      }
      try {
        console.log('Deleting version:', versionId)
        await deleteVersion(versionId)
        console.log('Version deleted successfully')
        res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error deleting version:', error)
        res.status(500).json({ error: 'Failed to delete version' })
      }
      break

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
}) 