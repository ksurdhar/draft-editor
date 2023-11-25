import { createVersion, getVersionsForDoc } from '@lib/mongo-utils'
import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { VersionData } from '@typez/globals'
import type { NextApiResponse } from 'next'

export default withHybridAuth(async function nestedDocumentsHandler(
  req: ExtendedApiRequest,
  res: NextApiResponse,
) {
  const { query, method, user } = req
  const documentId = query.params && query.params.length > 0 ? query.params[0] : ''

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  // /documents/123/versions
  switch (method) {
    case 'POST':
      const newVersion = await createVersion(req.body)
      res.status(200).json(newVersion)
      break
    case 'GET':
      const versions = await getVersionsForDoc(documentId)
      res.status(200).json(versions as VersionData[])
      break
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})
