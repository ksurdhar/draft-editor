import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { createVersion, getVersionsForDoc, getDocument, deleteVersion } from '@lib/mongo-utils'
import * as Y from 'yjs'

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

        // Convert YJS state to readable content for each version
        const versionsWithContent = versions.map(version => {
          console.log('\nProcessing version:', version.id)
          console.log('Version content type:', typeof version.content)
          console.log('Is YJS content?', version.content?.type === 'yjs')
          
          if (version.content?.type === 'yjs' && Array.isArray(version.content.state)) {
            console.log('YJS state array length:', version.content.state.length)
            const ydoc = new Y.Doc()
            const state = new Uint8Array(version.content.state)
            Y.applyUpdate(ydoc, state)
            const ytext = ydoc.getText('content')
            const content = ytext.toString()
            console.log('Deserialized content length:', content.length)
            console.log('Content preview:', content.substring(0, 100))
            
            return {
              ...version,
              content
            }
          } else {
            console.log('Non-YJS content, returning as-is')
            return version
          }
        })

        res.status(200).json(versionsWithContent)
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
        console.log('Input content length:', typeof req.body.content === 'string' ? req.body.content.length : 'non-string')
        console.log('Input content preview:', typeof req.body.content === 'string' ? 
          req.body.content.substring(0, 100) : 
          JSON.stringify(req.body.content).substring(0, 100))

        // Create YJS document and insert content
        const ydoc = new Y.Doc()
        const ytext = ydoc.getText('content')
        
        if (typeof req.body.content === 'string') {
          ytext.insert(0, req.body.content)
        } else {
          ytext.insert(0, JSON.stringify(req.body.content))
        }

        console.log('YJS text content after insert:', ytext.toString().substring(0, 100))
        console.log('YJS text length:', ytext.toString().length)

        // Get YJS state
        const state = Y.encodeStateAsUpdate(ydoc)
        console.log('YJS state array length:', state.length)

        // Verify state can be decoded
        const verifyDoc = new Y.Doc()
        Y.applyUpdate(verifyDoc, state)
        const verifyText = verifyDoc.getText('content').toString()
        console.log('Verification - decoded content length:', verifyText.length)
        console.log('Verification - decoded content preview:', verifyText.substring(0, 100))

        const newVersion = await createVersion({
          documentId,
          ownerId: user.sub,
          content: {
            type: 'yjs',
            state: Array.from(state)
          },
          createdAt: req.body.createdAt || Date.now(),
          name: req.body.name || '',
          wordCount: typeof req.body.content === 'string' ? 
            req.body.content.split(/\s+/).length : 
            JSON.stringify(req.body.content).split(/\s+/).length
        })
        
        console.log('Version created successfully:', newVersion.id)
        console.log('Stored state array length:', (newVersion.content as any).state.length)
        
        // Return the readable content in the response
        res.status(200).json({
          ...newVersion,
          content: ytext.toString()
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