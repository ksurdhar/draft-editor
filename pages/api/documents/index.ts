import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { DocumentData, UserPermission } from '@typez/globals'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import { DEFAULT_DOCUMENT_CONTENT, DEFAULT_DOCUMENT_TITLE } from '@lib/constants'
import { createPermission } from '@lib/mongo-utils'

const handlers = {
  async POST(req: ExtendedApiRequest, res: NextApiResponse) {
    const now = Date.now()
    const newDocument = await storage.create('documents', {
      ...req.body,
      userId: req.user!.sub,
      title: req.body.title || DEFAULT_DOCUMENT_TITLE,
      content: req.body.content || DEFAULT_DOCUMENT_CONTENT,
      comments: [],
      lastUpdated: now
    })

    // Create permission record for the document
    try {
      await createPermission({
        documentId: newDocument._id,
        ownerId: req.user!.sub,
        globalPermission: UserPermission.None
      })
    } catch (error) {
      console.error('Error creating permission record:', error)
      // Don't fail the request if permission creation fails
    }

    res.status(200).json(newDocument)
  },

  async GET(req: ExtendedApiRequest, res: NextApiResponse) {
    const documents = await storage.find('documents', { userId: req.user!.sub })
    const docsWithPermissions = documents.map(doc => ({
      ...doc,
      id: doc._id,
      canEdit: true,
      canComment: true,
      lastUpdated: doc.lastUpdated || Date.now()
    }))
    res.status(200).json(docsWithPermissions as DocumentData[])
  },
}

export default withHybridAuth(async function documentsHandler(req: ExtendedApiRequest, res: NextApiResponse) {
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
