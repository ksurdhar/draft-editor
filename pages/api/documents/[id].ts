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
import { getSession } from '@wrappers/auth-wrapper'
import type { NextApiResponse } from 'next'

export default withHybridAuth(async function documentHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  let { query, method, user } = req
  console.log('Query: ', query)
  console.log('Method: ', method)
  console.log('User: ', user)

  const documentId = query.id?.toString() || ''
  console.log('Document ID: ', documentId)

  const session = await getSession(req, res)
  console.log('Session: ', session)

  user = user || session?.user
  console.log('Updated User: ', user)

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  let permissions = (await getPermissionByDoc(documentId)) as PermissionData
  console.log('Permissions: ', permissions)

  if (permissions === null) {
    permissions = await createPermission({ ownerId: user.sub, documentId: documentId })
    console.log('Created Permissions for Older Document: ', permissions)
  }

  const isOwner = permissions.ownerId === user.sub
  console.log('Is Owner: ', isOwner)

  const permissableUser = permissions?.users.find(u => u.email === user!.email)
  console.log('Permissable User: ', permissableUser)

  const isOwnerOrInvited = permissableUser || isOwner
  console.log('Is Owner Or Invited: ', isOwnerOrInvited)

  const isRestricted = permissions.globalPermission === UserPermission.None
  console.log('Is Restricted: ', isRestricted)

  const userCanComment =
    (permissableUser && [UserPermission.Comment, UserPermission.Edit].includes(permissableUser.permission)) ||
    isOwner
  console.log('User Can Comment: ', userCanComment)

  const userCanEdit = (permissableUser && permissableUser.permission === UserPermission.Edit) || isOwner
  console.log('User Can Edit: ', userCanEdit)

  const anyoneCanComment = [UserPermission.Comment, UserPermission.Edit].includes(
    permissions.globalPermission,
  )
  console.log('Anyone Can Comment: ', anyoneCanComment)

  const anyoneCanEdit = permissions.globalPermission === UserPermission.Edit
  console.log('Anyone Can Edit: ', anyoneCanEdit)
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
