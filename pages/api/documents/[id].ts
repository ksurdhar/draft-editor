import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import * as Y from 'yjs'

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

      // Convert YJS state to readable content
      let content = ''
      const docContent = document.content as { type?: string; state?: number[] } | string | undefined
      
      if (docContent && typeof docContent === 'object' && 
          docContent.type === 'yjs' && Array.isArray(docContent.state)) {
        console.log('Converting YJS state to readable content')
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(docContent.state))
        content = ydoc.getText('content').toString()
        console.log('Content length:', content.length)
      } else {
        content = typeof docContent === 'string' ? docContent : JSON.stringify(docContent)
      }

      // For local storage, everyone has full permissions
      const documentWithPermissions = {
        ...document,
        content,
        canEdit: true,
        canComment: true,
        lastUpdated: document.lastUpdated || Date.now()
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

      // Only process content if it's being updated
      let content = req.body.content
      if (content !== undefined) {
        console.log('Converting content to YJS state')
        const ydoc = new Y.Doc()
        const ytext = ydoc.getText('content')
        
        if (typeof content === 'string') {
          ytext.insert(0, content)
        } else {
          ytext.insert(0, JSON.stringify(content))
        }

        const state = Y.encodeStateAsUpdate(ydoc)
        console.log('YJS state length:', state.length)
        
        content = {
          type: 'yjs',
          state: Array.from(state)
        }
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date().toISOString(),
        lastUpdated: Date.now()
      }

      // Only include content in update if it was provided
      if (content !== undefined) {
        updateData.content = content
      }

      const updatedDocument = await storage.update('documents', documentId, updateData)

      if (!updatedDocument) {
        return res.status(500).json({ error: 'Failed to update document' })
      }

      // Convert YJS state back to readable content for response
      let responseContent = updatedDocument.content
      if (responseContent && typeof responseContent === 'object' && responseContent.type === 'yjs') {
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(responseContent.state))
        responseContent = ydoc.getText('content').toString()
      }

      res.status(200).json({
        ...updatedDocument,
        content: responseContent
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
