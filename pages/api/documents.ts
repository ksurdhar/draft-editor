import type { NextApiRequest, NextApiResponse } from 'next'
import { createDocument, getDocuments } from "../../lib/apiUtils"

export default async function documentsHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method } = req

  switch (method) {
    case 'POST': 
      const newDocument = await createDocument(req.body)
      res.status(200).json(newDocument)
      break
    case 'GET':
      const document = await getDocuments()
      res.status(200).json(document)
      break
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
} 