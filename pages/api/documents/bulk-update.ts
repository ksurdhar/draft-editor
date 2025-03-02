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
      await Promise.all(
        updates.map(async (update) => {
          const doc = await storage.findById('documents', update.documentId)
          if (!doc || doc.userId !== userId) {
            throw new Error('Access denied to one or more documents')
          }
        })
      )

      // Perform updates with stringified content
      const results = await Promise.all(
        updates.map(update => {
          // Prepare content as stringified JSON
          let content = update.content
          
          if (typeof content === 'object') {
            // If content is an object, stringify it
            content = JSON.stringify(content)
          } else if (typeof content === 'string') {
            // If it's already a string, make sure it's valid JSON
            try {
              // Try to parse it to validate, but keep it as a string
              JSON.parse(content)
              // It's already a valid JSON string, no need to modify
            } catch (e) {
              // If it's not valid JSON, wrap it as a string value in JSON
              content = JSON.stringify(content)
            }
          }
          
          return storage.update('documents', update.documentId, {
            content,
            lastUpdated: Date.now()
          })
        })
      )

      // Parse content in results for the response
      const parsedResults = results.map(result => {
        if (result && typeof result.content === 'string') {
          try {
            const parsedContent = JSON.parse(result.content)
            return {
              ...result,
              content: parsedContent
            }
          } catch (e) {
            // If parsing fails, return as is
            return result
          }
        }
        return result
      })

      res.status(200).json({ success: true, results: parsedResults })
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