import { createDocument, createPermission, getDocuments } from "@lib/mongo-utils"
import { DocumentData } from '@typez/globals'
import { getSession, withApiAuthRequired } from '@wrappers/auth-wrapper'
import type { NextApiRequest, NextApiResponse } from 'next'

export default withApiAuthRequired(async function documentsHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const session = await getSession(req, res)

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