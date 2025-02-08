import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { DocumentData } from '@typez/globals'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'

const handlers = {
  async POST(req: ExtendedApiRequest, res: NextApiResponse) {
    const now = Date.now()
    const newDocument = await storage.create('documents', {
      ...req.body,
      userId: req.user!.sub,
      content: JSON.stringify([{ type: 'default', children: [{ text: '', highlight: 'none' }] }]),
      comments: [],
      lastUpdated: now
    })
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
