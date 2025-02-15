import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'

interface BulkUpdateRequest {
  updates: {
    documentId: string
    content: any
  }[]
}

const handlers = {
  async POST(req: ExtendedApiRequest, res: NextApiResponse) {
    const { updates } = req.body as BulkUpdateRequest
    const userId = req.user!.sub

    try {
      // Verify user has access to all documents
      const docs = await Promise.all(
        updates.map(update => storage.findById('documents', update.documentId))
      )

      // Check if any documents don't exist or user doesn't have access
      const invalidDocs = docs.filter((doc, i) => !doc || doc.userId !== userId)
      if (invalidDocs.length > 0) {
        return res.status(403).json({ error: 'Access denied to one or more documents' })
      }

      // Perform updates
      const results = await Promise.all(
        updates.map(update => 
          storage.update('documents', update.documentId, {
            content: update.content,
            lastUpdated: Date.now()
          })
        )
      )

      res.status(200).json({ success: true, results })
    } catch (error) {
      console.error('Error in bulk update:', error)
      res.status(500).json({ error: 'Failed to update documents' })
    }
  }
}

export default withHybridAuth(async function bulkUpdateHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { method, user } = req

  if (!user) {
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
    console.error('Unexpected error:', error)
    res.status(500).end('Internal Server Error')
  }
}) 