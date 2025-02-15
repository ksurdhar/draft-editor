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
  const versionId = query.versionId?.toString()

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

    case 'DELETE':
      if (!versionId) {
        res.status(400).json({ error: 'Version ID is required' })
        return
      }
      const success = await versionStorage.deleteVersion(documentId, versionId)
      if (!success) {
        res.status(404).json({ error: 'Version not found' })
        return
      }
      res.status(200).json({ success: true })
      break

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
}) 