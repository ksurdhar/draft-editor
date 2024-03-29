import {
  createOrUpdateVersion,
  createPermission,
  deleteDocument,
  deletePermissionByDoc,
  getDocument,
  getPermissionByDoc,
  updateDocument,
} from '@lib/mongo-utils'
import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { DocumentData, PermissionData, UserPermission } from '@typez/globals'
import type { NextApiResponse } from 'next'

export default withHybridAuth(async function documentHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  let { query, method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  const documentId = query.id?.toString() || ''

  let permissions = (await getPermissionByDoc(documentId)) as PermissionData

  if (permissions === null) {
    permissions = await createPermission({ ownerId: user.sub, documentId })
  }

  const isOwner = permissions.ownerId === user.sub

  const permissableUser = permissions?.users.find(u => u.email === user!.email)

  const isOwnerOrInvited = permissableUser || isOwner

  const isRestricted = permissions.globalPermission === UserPermission.None

  const userCanComment =
    (permissableUser && [UserPermission.Comment, UserPermission.Edit].includes(permissableUser.permission)) ||
    isOwner

  const userCanEdit = (permissableUser && permissableUser.permission === UserPermission.Edit) || isOwner

  const anyoneCanComment = [UserPermission.Comment, UserPermission.Edit].includes(
    permissions.globalPermission,
  )

  const anyoneCanEdit = permissions.globalPermission === UserPermission.Edit
  switch (method) {
    case 'GET':
      const document = (await getDocument(documentId)) as DocumentData

      if (isRestricted && isOwnerOrInvited) {
        document.canComment = userCanComment
        document.canEdit = userCanEdit
        return res.status(200).json(document)
      }

      if (isRestricted && !isOwnerOrInvited) {
        return res.status(400).send({ error: 'you do not have the permissions to view this file' })
      }

      document.canComment = anyoneCanComment || isOwner
      document.canEdit = anyoneCanEdit || isOwner
      res.status(200).json(document)
      break
    case 'PATCH':
      if (isRestricted) {
        if (userCanComment || userCanEdit || isOwner) {
          const updatedDocument = (await updateDocument(documentId, req.body)) as DocumentData
          await createOrUpdateVersion(documentId, updatedDocument)

          return res.status(200).json(updatedDocument)
        } else {
          return res.status(400).send({ error: 'you do not have the permissions to modify this file' })
        }
      }
      if (anyoneCanEdit || anyoneCanComment || isOwner) {
        const updatedDocument = (await updateDocument(documentId, req.body)) as DocumentData
        await createOrUpdateVersion(documentId, updatedDocument)

        return res.status(200).json(updatedDocument)
      } else {
        return res.status(400).send({ error: 'you do not have the permissions to modify this file' })
      }
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
})
