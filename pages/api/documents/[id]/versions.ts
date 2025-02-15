import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { VersionStorage } from '@lib/storage/version-storage'

const versionStorage = new VersionStorage()

export default withHybridAuth(async function versionsHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { query, method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  const documentId = query.id?.toString() || ''

  switch (method) {
    case 'GET':
      const versions = await versionStorage.getVersions(documentId)
      res.status(200).json(versions)
      break

    case 'POST':
      const newVersion = await versionStorage.createVersion({
        ...req.body,
        documentId
      })
      res.status(200).json(newVersion)
      break

    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
}) 