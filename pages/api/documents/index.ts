import { createDocument, createPermission, getDocuments } from '@lib/mongo-utils'
import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { DocumentData } from '@typez/globals'
import type { NextApiResponse } from 'next'

const handlers = {
  async POST(req: ExtendedApiRequest, res: NextApiResponse) {
    const newDocument = await createDocument(req.body)
    await createPermission({ ownerId: req.user!.sub, documentId: newDocument.id })
    res.status(200).json(newDocument)
  },

  async GET(req: ExtendedApiRequest, res: NextApiResponse) {
    const documents = await getDocuments(req.user!.sub)
    const docsWithPermissions = documents.map(doc => {
      doc.canEdit = true
      doc.canComment = true
      return doc
    })
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
