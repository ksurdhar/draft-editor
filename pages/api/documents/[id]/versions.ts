import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { createVersion, getVersionsForDoc, getDocument, deleteVersion } from '@lib/mongo-utils'

export default withHybridAuth(async function versionsHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { query, method, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  const documentId = query.id?.toString() || ''
  const versionId = query.versionId?.toString()

  // Check document ownership
  const document = await getDocument(documentId)
  if (!document) {
    res.status(404).json({ error: 'Document not found' })
    return
  }
  if (document.userId !== user.sub) {
    res.status(403).json({ error: 'Not authorized to access this document' })
    return
  }

  switch (method) {
    case 'GET':
      try {
        console.log('\n=== Fetching Versions ===')
        console.log('Document ID:', documentId)
        const versions = await getVersionsForDoc(documentId)
        console.log('Found versions:', versions.length)

        // Parse stringified JSON content for each version
        const versionsWithParsedContent = versions.map(version => {
          console.log('\nProcessing version:', version.id)
          console.log('Version content type:', typeof version.content)
          
          if (typeof version.content === 'string') {
            try {
              // Try to parse the content as JSON
              const parsedContent = JSON.parse(version.content)
              console.log('Successfully parsed content as JSON')
              
              return {
                ...version,
                content: parsedContent
              }
            } catch (e) {
              console.log('Warning: Could not parse version content as JSON, returning as-is')
              return version
            }
          } else {
            console.log('Non-string content, returning as-is')
            return version
          }
        })
        
        res.status(200).json(versionsWithParsedContent)
      } catch (error) {
        console.error('Error fetching versions:', error)
        res.status(500).json({ error: 'Failed to fetch versions' })
      }
      break

    case 'POST':
      try {
        if (!req.body) {
          res.status(400).json({ error: 'Request body is required' })
          return
        }

        if (!req.body.content) {
          res.status(400).json({ error: 'Content is required' })
          return
        }

        console.log('\n=== Creating Version ===')
        console.log('Document ID:', documentId)
        console.log('Input content type:', typeof req.body.content)
        
        // Prepare content as stringified JSON
        let contentToStore = req.body.content
        
        if (typeof contentToStore === 'object') {
          // If content is an object, stringify it
          console.log('Stringifying object content')
          contentToStore = JSON.stringify(contentToStore)
        } else if (typeof contentToStore === 'string') {
          // If it's already a string, make sure it's valid JSON
          try {
            // Try to parse it to validate, but keep it as a string
            JSON.parse(contentToStore)
            console.log('Content is already a valid JSON string')
          } catch (e) {
            // If it's not valid JSON, wrap it as a string value in JSON
            console.log('Content is not valid JSON, wrapping as string value')
            contentToStore = JSON.stringify(contentToStore)
          }
        }

        // Calculate word count from the content
        const wordCount = typeof req.body.content === 'string' ? 
          req.body.content.split(/\s+/).length : 
          JSON.stringify(req.body.content).split(/\s+/).length

        // Create the version with stringified content
        const newVersion = await createVersion({
          documentId,
          ownerId: user.sub,
          content: contentToStore,
          createdAt: req.body.createdAt || Date.now(),
          name: req.body.name || '',
          wordCount
        })
        
        console.log('Version created successfully:', newVersion.id)

        // Parse the content for the response
        let responseContent = newVersion.content
        if (typeof responseContent === 'string') {
          try {
            responseContent = JSON.parse(responseContent)
          } catch (e) {
            console.log('Warning: Could not parse version content for response')
            // Keep as string if parsing fails
          }
        }
        
        // Return the parsed content in the response
        res.status(200).json({
          ...newVersion,
          content: responseContent
        })
      } catch (error) {
        console.error('Error creating version:', error)
        res.status(500).json({ 
          error: 'Failed to create version',
          details: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      break

    case 'DELETE':
      if (!versionId) {
        res.status(400).json({ error: 'Version ID is required' })
        return
      }
      try {
        console.log('\n=== Deleting Version ===')
        console.log('Document ID:', documentId)
        console.log('Version ID:', versionId)
        await deleteVersion(versionId)
        console.log('Version deleted successfully')
        res.status(200).json({ success: true })
      } catch (error) {
        console.error('Error deleting version:', error)
        res.status(500).json({ error: 'Failed to delete version' })
      }
      break

    default:
      res.setHeader('Allow', ['GET', 'POST', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
}) 