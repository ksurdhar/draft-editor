import type { NextApiRequest, NextApiResponse } from 'next'
import { createNewDocument, fetchUserDocuments } from '../../../controllers/documents'
import { getSession, withApiAuthRequired } from '../../../mocks/auth-wrapper'

export default withApiAuthRequired(async function documentsHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const session = getSession(req, res)

  switch (method) {
    case 'POST': 
        const newDoc = await createNewDocument(req.body, session?.user.sub)
        res.status(200).json(newDoc)
      break
    case 'GET':
      if (session) {
        const docs = await fetchUserDocuments(session.user.sub)
        res.status(200).json(docs)
      }
      break
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})