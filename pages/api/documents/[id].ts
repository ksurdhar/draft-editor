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
      console.log('\n=== Getting Document ===')
      console.log('Document ID:', documentId)

      const document = await storage.findById('documents', documentId)
      if (!document) {
        return res.status(404).json({ error: 'Document not found' })
      }

      // Parse stringified JSON content
      let parsedContent = document.content
      if (typeof document.content === 'string') {
        try {
          parsedContent = JSON.parse(document.content)
        } catch (e) {
          console.log('Warning: Could not parse document content')
          // Keep as string if parsing fails
        }
      }

      // For local storage, everyone has full permissions
      const documentWithPermissions = {
        ...document,
        content: parsedContent,
        canEdit: true,
        canComment: true,
        lastUpdated: document.lastUpdated || Date.now(),
      }

      res.status(200).json(documentWithPermissions)
      break
    }
    case 'PATCH': {
      console.log('\n=== Updating Document ===')
      console.log('Document ID:', documentId)

      const document = await storage.findById('documents', documentId)
      if (!document) {
        return res.status(404).json({ error: 'Document not found' })
      }

      // Stringify content if it's provided
      const updateData = {
        ...req.body,
        updatedAt: new Date().toISOString(),
        lastUpdated: Date.now(),
      }

      // If content is provided, ensure it's stringified
      if (req.body.content !== undefined) {
        if (typeof req.body.content === 'object') {
          updateData.content = JSON.stringify(req.body.content)
        } else if (typeof req.body.content === 'string') {
          // Validate that it's proper JSON
          try {
            JSON.parse(req.body.content)
            updateData.content = req.body.content
          } catch (e) {
            // If not valid JSON, stringify it as a string value
            updateData.content = JSON.stringify(req.body.content)
          }
        }
      }

      const updatedDocument = await storage.update('documents', documentId, updateData)

      if (!updatedDocument) {
        return res.status(500).json({ error: 'Failed to update document' })
      }

      // Parse the content for the response
      let parsedContent = updatedDocument.content
      if (typeof updatedDocument.content === 'string') {
        try {
          parsedContent = JSON.parse(updatedDocument.content)
        } catch (e) {
          console.log('Warning: Could not parse updated document content')
          // Keep as string if parsing fails
        }
      }

      res.status(200).json({
        ...updatedDocument,
        content: parsedContent,
      })
      break
    }
    case 'DELETE': {
      console.log('\n=== Deleting Document ===')
      console.log('Document ID:', documentId)

      const { id } = req.query
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid document ID' })
      }
      await storage.delete('documents', { _id: id, userId: req.user!.sub })
      console.log('Document deleted successfully')
      res.status(200).json({ success: true })
      break
    }
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})
