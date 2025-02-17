import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'

export default withHybridAuth(async function nestedDocumentsHandler(
  req: ExtendedApiRequest,
  res: NextApiResponse,
) {
  const { method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  // This endpoint is reserved for future nested document operations
  res.status(404).end('Not Found')
})
