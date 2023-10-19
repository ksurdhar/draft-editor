import type { NextApiRequest, NextApiResponse } from 'next'
import { getPermissionByDoc, updatePermissionByDoc } from "../../../lib/mongo-utils"
import { getSession } from '../../../mocks/auth-wrapper'
import { PermissionData } from '../../../types/globals'

export default async function permissionHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method } = req
  const session = getSession(req, res)

  const permissionId = (query.id?.toString() || '')

  const permission = await getPermissionByDoc(permissionId) as PermissionData
  const isOwner = permission.ownerId === session?.user.sub
  
  switch (method) {
    case 'GET':
      if (isOwner) {
        return res.status(200).json(permission)
      }
      return res.status(400).send({ error: 'you do not have the permissions to access this resource' })

    case 'PATCH':
      if (isOwner) {
        const updatedPermission = await updatePermissionByDoc(permissionId, req.body) as PermissionData
        return res.status(200).json(updatedPermission)
      }
      return res.status(400).send({ error: 'you do not have the permissions to modify this resource' })

    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
} 