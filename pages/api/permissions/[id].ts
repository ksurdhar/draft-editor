import { getPermissionByDoc, updatePermissionByDoc } from '@lib/mongo-utils'
import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { PermissionData, UserPermission } from '@typez/globals'
import type { NextApiResponse } from 'next'

export default withHybridAuth(async function permissionHandler(
  req: ExtendedApiRequest,
  res: NextApiResponse,
) {
  const { query, method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  const documentId = query.id?.toString() || ''
  if (!documentId) {
    res.status(400).json({ error: 'Document ID is required' })
    return
  }

  const permission = await getPermissionByDoc(documentId)

  // If permission doesn't exist, return a default permission object
  if (!permission) {
    return res.status(200).json({
      documentId,
      ownerId: user.sub,
      globalPermission: UserPermission.None,
      users: [],
    } as PermissionData)
  }

  const isOwner = permission.ownerId === user.sub

  switch (method) {
    case 'GET':
      if (isOwner) {
        return res.status(200).json(permission)
      }
      return res.status(403).json({ error: 'You do not have permission to access this resource' })

    case 'PATCH':
      if (isOwner) {
        const updatedPermission = (await updatePermissionByDoc(documentId, req.body)) as PermissionData
        return res.status(200).json(updatedPermission)
      }
      return res.status(403).json({ error: 'You do not have permission to modify this resource' })

    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})
