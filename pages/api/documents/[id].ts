import { getSession } from '@auth0/nextjs-auth0'
import type { NextApiRequest, NextApiResponse } from 'next'
import { deleteDocument, getDocument, updateDocument } from "../../../lib/mongoUtils"
import { DocumentData } from '../../../types/globals'

export default async function documentHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method } = req
  const session = getSession(req, res)

  switch (method) {
    case 'GET':
      const document = await getDocument(query.id.toString()) as DocumentData
      const isRestricted = document.view.length > 0
      const inView = document.view.includes(session?.user.email)
      const inComment = document.comment.includes(session?.user.email)
      const inEdit = document.edit.includes(session?.user.email)
      const userHasPermission = inView || inComment || inEdit

      if (isRestricted) {
        if (userHasPermission) {
          document.canComment = inEdit || inComment
          document.canEdit = inEdit

          return res.status(200).json(document)
        } else {
          return res.status(400).send({ error: 'you do not have the permissions to view this file' })
        }
      }
      res.status(200).json(document)
      break
    case 'PATCH':
      // check to see whether user has permission to update
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