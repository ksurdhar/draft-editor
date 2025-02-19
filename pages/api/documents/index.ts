import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { DocumentData, UserPermission } from '@typez/globals'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import { DEFAULT_DOCUMENT_CONTENT, DEFAULT_DOCUMENT_TITLE } from '@lib/constants'
import { createPermission } from '@lib/mongo-utils'
import * as Y from 'yjs'

const handlers = {
  async POST(req: ExtendedApiRequest, res: NextApiResponse) {
    console.log('\n=== Creating New Document ===')
    
    // Create YJS document with default or provided content
    const ydoc = new Y.Doc()
    const ytext = ydoc.getText('content')
    
    if (req.body.content) {
      console.log('Using provided content')
      if (typeof req.body.content === 'string') {
        ytext.insert(0, req.body.content)
      } else {
        ytext.insert(0, JSON.stringify(req.body.content))
      }
    } else {
      console.log('Using default content')
      ytext.insert(0, JSON.stringify(DEFAULT_DOCUMENT_CONTENT))
    }

    // Get YJS state
    const state = Y.encodeStateAsUpdate(ydoc)
    console.log('YJS state length:', state.length)

    const now = Date.now()
    const newDocument = await storage.create('documents', {
      ...req.body,
      userId: req.user!.sub,
      title: req.body.title || DEFAULT_DOCUMENT_TITLE,
      content: {
        type: 'yjs',
        state: Array.from(state)
      },
      comments: [],
      lastUpdated: now
    })

    console.log('Document created:', newDocument._id)

    // Create permission record for the document
    try {
      await createPermission({
        documentId: newDocument._id,
        ownerId: req.user!.sub,
        globalPermission: UserPermission.None
      })
      console.log('Permission record created')
    } catch (error) {
      console.error('Error creating permission record:', error)
      // Don't fail the request if permission creation fails
    }

    // Return document with readable content
    res.status(200).json({
      ...newDocument,
      content: ytext.toString()
    })
  },

  async GET(req: ExtendedApiRequest, res: NextApiResponse) {
    console.log('\n=== Fetching Documents ===')
    console.log('User ID:', req.user!.sub)
    
    const documents = await storage.find('documents', { userId: req.user!.sub })
    console.log('Found documents:', documents.length)

    // Convert YJS state to readable content for each document
    const docsWithPermissions = await Promise.all(documents.map(async doc => {
      let content = ''
      const docContent = doc.content as { type?: string; state?: number[] } | string | undefined
      
      if (docContent && typeof docContent === 'object' && 
          docContent.type === 'yjs' && Array.isArray(docContent.state)) {
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(docContent.state))
        content = ydoc.getText('content').toString()
      } else {
        content = typeof docContent === 'string' ? docContent : JSON.stringify(docContent)
      }

      return {
        ...doc,
        id: doc._id,
        content,
        canEdit: true,
        canComment: true,
        lastUpdated: doc.lastUpdated || Date.now()
      }
    }))

    res.status(200).json(docsWithPermissions as DocumentData[])
  },
}

export default withHybridAuth(async function documentsHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { method, user } = req

  console.log('req', req)
  console.log('user', user)

  if (!user) {
    // Log the auth failure with details
    console.error('Auth failed:', {
      headers: req.headers,
      method,
      url: req.url,
      timestamp: new Date().toISOString()
    })
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
    // Log the full error details
    console.error('API Error:', {
      error: error instanceof Error ? error.message : error,
      method,
      url: req.url,
      user: user.sub,
      timestamp: new Date().toISOString()
    })
    res.status(500).end('Internal Server Error')
  }
})
