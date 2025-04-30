import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import { DocumentData, UserPermission } from '@typez/globals'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import { DEFAULT_DOCUMENT_CONTENT, DEFAULT_DOCUMENT_TITLE } from '@lib/constants'
import { createPermission } from '@lib/mongo-utils'
import { computeEntityHash } from '../../../utils/computeEntityHash'

const handlers = {
  async POST(req: ExtendedApiRequest, res: NextApiResponse) {
    let content = req.body.content

    if (!content) {
      console.log('Using default content')
      content = JSON.stringify(DEFAULT_DOCUMENT_CONTENT)
    } else if (typeof content === 'object') {
      console.log('Stringifying object content')
      content = JSON.stringify(content)
    } else if (typeof content === 'string') {
      try {
        JSON.parse(content)
        console.log('Content is already a valid JSON string')
      } catch (e) {
        console.log('Content is not valid JSON, wrapping as string value')
        content = JSON.stringify(content)
      }
    }

    const now = Date.now()

    // Check if a client-supplied ID was provided
    const documentData = {
      ...req.body,
      userId: req.user!.sub,
      title: req.body.title || DEFAULT_DOCUMENT_TITLE,
      content,
      comments: [],
      lastUpdated: now,
    }

    // If client supplied an _id, use it
    if (req.body._id) {
      console.log('Using client-supplied ID:', req.body._id)
      documentData._id = req.body._id
    }

    // If client supplied a hash, use it, otherwise generate one
    if (!documentData.hash) {
      documentData.hash = computeEntityHash(documentData)
      console.log('Generated hash for new document:', documentData.hash)
    } else {
      console.log('Using client-supplied hash:', documentData.hash)
    }

    const newDocument = await storage.create('documents', documentData)

    console.log('Document created:', newDocument._id)

    // Create permission record for the document
    try {
      await createPermission({
        documentId: newDocument._id,
        ownerId: req.user!.sub,
        globalPermission: UserPermission.None,
      })
      console.log('Permission record created')
    } catch (error) {
      console.error('Error creating permission record:', error)
      // Don't fail the request if permission creation fails
    }

    // For the response, parse the stringified content back to an object
    let responseContent
    try {
      responseContent = JSON.parse(content)
    } catch (e) {
      // If parsing fails, use the string as is
      responseContent = content
    }

    // Return document with parsed content for the response
    res.status(200).json({
      ...newDocument,
      content: responseContent,
    })
  },

  async GET(req: ExtendedApiRequest, res: NextApiResponse) {
    console.log('documents GET start')

    const { metadataOnly } = req.query
    console.log('metadataOnly', metadataOnly === 'true')

    // Use projection to exclude content field when metadataOnly is true
    const findOptions = metadataOnly === 'true' ? { projection: { content: 0 } } : {}

    const documents = await storage.find('documents', { userId: req.user!.sub }, findOptions)

    console.log('documents retrieved from storage', documents.length)

    // Process documents and parse stringified JSON
    const docsWithPermissions = await Promise.all(
      documents.map(async doc => {
        let content = doc.content

        // Only parse content if it exists (it won't if metadataOnly=true)
        if (content && typeof content === 'string') {
          // Try to parse stringified JSON
          try {
            content = JSON.parse(content)
          } catch (e) {
            console.log(`Warning: Could not parse content for document ${doc._id}`)
            // Keep as string if parsing fails
          }
        }

        return {
          ...doc,
          id: doc._id,
          content,
          canEdit: true,
          canComment: true,
          lastUpdated: doc.lastUpdated || Date.now(),
        }
      }),
    )

    res.status(200).json(docsWithPermissions as DocumentData[])
  },
}

export default withHybridAuth(async function documentsHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { method, user } = req

  if (!user) {
    // Log the auth failure with details
    console.error('Auth failed:', {
      headers: req.headers,
      method,
      url: req.url,
      timestamp: new Date().toISOString(),
    })
    res.status(401).end('Unauthorized')
    return
  }

  const handler = handlers[method as keyof typeof handlers]

  if (!handler) {
    res.setHeader('Allow', Object.keys(handlers))
    res.status(405).end(`Method ${method} Not Allowed`)
    return
  }

  try {
    await handler(req, res)
  } catch (error) {
    // Log the full error details
    console.error('API Error:', {
      error: error instanceof Error ? error.message : error,
      method,
      url: req.url,
      user: user.sub,
      timestamp: new Date().toISOString(),
    })
    res.status(500).end('Internal Server Error')
  }
})
