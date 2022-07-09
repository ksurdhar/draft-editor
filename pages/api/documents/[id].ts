import type { NextApiRequest, NextApiResponse } from 'next'
import { deleteDocument, getDocument, updateDocument } from "../../../lib/apiUtils"

export default async function documentHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method } = req

  switch (method) {
    case 'GET':
      const document = await getDocument(query.id.toString()) as DocumentData
      res.status(200).json(document)
      break
    case 'PATCH':
      const updatedDocument = await updateDocument(query.id.toString(), req.body) as DocumentData
      res.status(200).json(updatedDocument)
      break
    case 'DELETE':
      await deleteDocument(query.id.toString())
      res.status(200).json('document deleted')
      break
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
} 