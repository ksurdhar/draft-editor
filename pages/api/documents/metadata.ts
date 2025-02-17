import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { getDocumentMetadata } from '@lib/mongo-utils'

export default withHybridAuth(async function metadataHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).end(`Method ${method} Not Allowed`)
    return
  }

  try {
    console.log('\n=== Fetching Document Metadata ===')
    console.log('User ID:', user.sub)
    
    const documents = await getDocumentMetadata(user.sub)
    console.log('Found documents:', documents.length)

    res.status(200).json(documents)
  } catch (error) {
    console.error('Error fetching document metadata:', error)
    res.status(500).json({ error: 'Failed to fetch document metadata' })
  }
}) 