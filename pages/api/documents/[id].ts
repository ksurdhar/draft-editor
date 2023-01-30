import { getSession } from '@auth0/nextjs-auth0'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createOrUpdateVersion, createPermission, deleteDocument, deletePermissionByDoc, getDocument, getPermissionByDoc, updateDocument } from "../../../lib/mongoUtils"
import { DocumentData, PermissionData, UserPermission } from '../../../types/globals'

export default async function documentHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method  } = req
  const session = getSession(req, res)
  const documentId = query.id.toString()

  let permissions = await getPermissionByDoc(documentId) as PermissionData
  if (permissions === null) { // for older, pre permission documents
    permissions = await createPermission({ ownerId: session?.user.sub, documentId: documentId })
  }

  const user = permissions?.users.find((user) => user.email === session?.user.email)
  const isOwner = permissions.ownerId === session?.user.sub

  const isRestricted = permissions.globalPermission === UserPermission.None
  const canComment = user && [UserPermission.Comment, UserPermission.Edit].indexOf(user.permission) > -1 || isOwner
  const canEdit = user && user.permission === UserPermission.Edit || isOwner
  const globalEdit = [UserPermission.Comment, UserPermission.Edit].indexOf(permissions.globalPermission) > -1
  const globalComment = permissions.globalPermission === UserPermission.Edit

  switch (method) {
    case 'GET':
      const document = await getDocument(documentId) as DocumentData

      if (isRestricted) {
        if (user || isOwner) {
          document.canComment = canComment
          document.canEdit = canEdit
          return res.status(200).json(document)
        } 
        else {
          return res.status(400).send({ error: 'you do not have the permissions to view this file' })
        }
      } 

      document.canComment = globalComment || isOwner
      document.canEdit = globalEdit || isOwner
      res.status(200).json(document)
      break
    case 'PATCH':
      if (isRestricted) {
        if (canComment || canEdit || isOwner) {
          const updatedDocument = await updateDocument(documentId, req.body) as DocumentData
          await createOrUpdateVersion(documentId, updatedDocument)

          return res.status(200).json(updatedDocument)
        } else {
          return res.status(400).send({ error: 'you do not have the permissions to modify this file' })
        }
      } 
      if (globalEdit || globalComment || isOwner) {
        const updatedDocument = await updateDocument(documentId, req.body) as DocumentData
        await createOrUpdateVersion(documentId, updatedDocument)

        return res.status(200).json(updatedDocument)
      } else {
        return res.status(400).send({ error: 'you do not have the permissions to modify this file' })
      }
      break
    case 'DELETE':
      if (isOwner) {
        await deleteDocument(documentId)
        await deletePermissionByDoc(documentId)
        res.status(200).json('document deleted')
      } else {
        return res.status(400).send({ error: 'you do not have the permissions to delete this file' })
      }
      
      break
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
} 