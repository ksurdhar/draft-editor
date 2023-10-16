import type { NextApiRequest, NextApiResponse } from 'next'
import { deleteVersion, updateVersion } from "../../../lib/mongo-utils"
import { withApiAuthRequired } from '../../../mocks/auth-wrapper'
import { VersionData } from '../../../types/globals'

export default withApiAuthRequired(async function versionHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method } = req
  const versionId = query.id.toString()

  // apply access control via auth0's interface
  switch (method) {
    case 'PATCH':
      const updatedVersion = await updateVersion(versionId, req.body) as VersionData
      res.status(200).json(updatedVersion)
      break

    case 'DELETE':
      await deleteVersion(versionId)
      res.status(200).json('document deleted')
      break

    default:
      res.setHeader('Allow', ['GET', 'PATCH'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})