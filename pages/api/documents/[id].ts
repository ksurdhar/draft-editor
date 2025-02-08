import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'

export default withHybridAuth(async function documentHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { query, method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  const documentId = query.id?.toString() || ''

  // In local storage mode, we skip permission checks and give full access
  switch (method) {
    case 'GET': {
      const document = await storage.findById('documents', documentId)
      if (!document) {
        return res.status(404).json({ error: 'Document not found' })
      }

      // For local storage, everyone has full permissions
      const documentWithPermissions = {
        ...document,
        canEdit: true,
        canComment: true,
        lastUpdated: document.lastUpdated || Date.now()
      }
      
      res.status(200).json(documentWithPermissions)
      break
    }
    case 'PATCH': {
      const document = await storage.findById('documents', documentId)
      if (!document) {
        return res.status(404).json({ error: 'Document not found' })
      }

      const updatedDocument = await storage.update('documents', documentId, {
        ...req.body,
        updatedAt: new Date().toISOString(),
        lastUpdated: Date.now()
      })

      if (!updatedDocument) {
        return res.status(500).json({ error: 'Failed to update document' })
      }

      res.status(200).json(updatedDocument)
      break
    }
    case 'DELETE': {
      const { id } = req.query
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid document ID' })
      }
      await storage.delete('documents', { _id: id, userId: req.user!.sub })
      res.status(200).json({ success: true })
      break
    }
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})
