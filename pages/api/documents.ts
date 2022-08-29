import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createDocument, getDocuments } from "../../lib/apiUtils"

export default withApiAuthRequired(async function documentsHandler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const session = getSession(req, res)

  switch (method) {
    case 'POST': 
      const newDocument = await createDocument(req.body)
      res.status(200).json(newDocument)
      break
    case 'GET':
      if (session) {
        const documents = await getDocuments(session.user.sub)
        res.status(200).json(documents)
      }
      break
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})