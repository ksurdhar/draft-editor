import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { DocumentData } from '@typez/globals'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import { ObjectId } from 'mongodb'
import * as Y from 'yjs'

async function bulkFetchHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { method, user, body } = req

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${method} Not Allowed`)
    return
  }

  // Validate input before checking auth
  if (!Array.isArray(body?.ids)) {
    return res.status(400).json({ error: 'ids must be an array' })
  }

  if (body.ids.length === 0) {
    return res.status(400).json({ error: 'No document IDs provided' })
  }

  // Now check auth
  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  console.log('\n=== Bulk Fetching Documents ===')
  console.log('User ID:', user.sub)
  
  const { ids, metadataOnly } = body
  
  // Filter out any invalid IDs and convert to ObjectId
  const objectIds = ids
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    .reduce((validIds: ObjectId[], id: string) => {
      try {
        validIds.push(new ObjectId(id))
        return validIds
      } catch {
        return validIds
      }
    }, [])

  if (objectIds.length === 0) {
    return res.status(400).json({ error: 'No valid document IDs provided' })
  }
  
  const query = { 
    userId: user.sub,
    _id: { $in: objectIds }
  }
  
  const documents = await storage.find('documents', query)
  console.log('Found documents:', documents.length)

  // Convert YJS state to readable content for each document
  const docsWithPermissions = await Promise.all(documents.map(async doc => {
    let content = ''
    
    // Only load content if metadataOnly is not set to true
    if (metadataOnly !== true) {
      const docContent = doc.content as { type?: string; state?: number[] } | string | undefined
      
      if (docContent && typeof docContent === 'object' && 
          docContent.type === 'yjs' && Array.isArray(docContent.state)) {
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(docContent.state))
        content = ydoc.getText('content').toString()
      } else {
        content = typeof docContent === 'string' ? docContent : JSON.stringify(docContent)
      }
    }

    return {
      ...doc,
      id: doc._id,
      content: metadataOnly === true ? undefined : content,
      canEdit: true,
      canComment: true,
      lastUpdated: doc.lastUpdated || Date.now()
    }
  }))

  res.status(200).json(docsWithPermissions as DocumentData[])
}

export default withHybridAuth(bulkFetchHandler) 