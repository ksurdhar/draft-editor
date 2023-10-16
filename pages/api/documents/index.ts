import type { NextApiRequest, NextApiResponse } from 'next'
import { createDocument, createPermission, getDocuments } from "../../../lib/mongo-utils"
import { getSession, withApiAuthRequired } from '../../../mocks/auth-wrapper'
import { DocumentData } from '../../../types/globals'

export default withApiAuthRequired(async function documentsHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const session = getSession(req, res)

  switch (method) {
    case 'POST': 
      const newDocument = await createDocument(req.body)
      await createPermission({ ownerId: session?.user.sub, documentId: newDocument.id })
      res.status(200).json(newDocument)
      break
    case 'GET':
      if (session) {
        const documents = await getDocuments(session.user.sub)
        const docsWithPermissions = documents.map(doc => {
          doc.canEdit = true
          doc.canComment = true
          return doc
        })
        res.status(200).json(docsWithPermissions as DocumentData[])
      }
      break
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})