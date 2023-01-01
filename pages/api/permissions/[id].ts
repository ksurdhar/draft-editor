import { getSession } from '@auth0/nextjs-auth0'
import type { NextApiRequest, NextApiResponse } from 'next'
import { deletePermission, getPermission, updatePermission } from "../../../lib/mongoUtils"
import { PermissionData } from '../../../types/globals'

export default async function permissionHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method } = req

  switch (method) {
    case 'GET':
      const permission = await getPermission(query.id.toString()) as PermissionData
      return res.status(200).json(permission)
      break
    case 'PATCH':
      const updatedPermission = await updatePermission(query.id.toString(), req.body) as PermissionData
      res.status(200).json(updatedPermission)
      break
    case 'DELETE':
      await deletePermission(query.id.toString())
      res.status(200).json('permission deleted')
      break
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
} 