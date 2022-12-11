import { getSession } from '@auth0/nextjs-auth0'
import type { NextApiRequest, NextApiResponse } from 'next'
import { deleteDocument, getDocument, updateDocument } from "../../../lib/apiUtils"
import { DocumentData } from '../../../types/globals'

export default async function documentHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method } = req
  const session = getSession(req, res)

  switch (method) {
    case 'GET':
      const document = await getDocument(query.id.toString()) as DocumentData
      const viewPermissions = document.view && document.view.length > 0

      if (viewPermissions) {
        if (session && document.view.includes(session.user.email)) {
          return res.status(200).json(document)
        } else {
          return res.status(400).send({ error: 'you do not have the permissions to view this file' })
        }
      }
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