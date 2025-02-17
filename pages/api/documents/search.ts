import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { Doc } from '@lib/mongo-models'
import * as Y from 'yjs'

export default withHybridAuth(async function searchHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { method, user, query } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).end(`Method ${method} Not Allowed`)
    return
  }

  const searchTerm = query.q?.toString() || ''
  const matchCase = query.matchCase === 'true'
  const wholeWord = query.wholeWord === 'true'

  if (!searchTerm) {
    res.status(400).json({ error: 'Search term is required' })
    return
  }

  try {
    console.log('\n=== Searching Documents ===')
    console.log('User ID:', user.sub)
    console.log('Search term:', searchTerm)
    console.log('Options:', { matchCase, wholeWord })

    // Create search regex
    let searchRegex = searchTerm
    if (wholeWord) {
      searchRegex = `\\b${searchRegex}\\b`
    }
    const regex = new RegExp(searchRegex, matchCase ? '' : 'i')

    // Search in title and content
    const documents = await Doc.find({
      userId: user.sub,
      $or: [
        { title: regex },
        { 'content.type': 'yjs' } // We'll check YJS content below
      ]
    })

    // Process results
    const results = await Promise.all(documents.map(async doc => {
      const document = doc.toJSON()
      let matches = []

      // Check title
      if (regex.test(document.title)) {
        matches.push({ type: 'title', text: document.title })
      }

      // Check content if it's YJS
      if (document.content?.type === 'yjs' && Array.isArray(document.content.state)) {
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(document.content.state))
        const content = ydoc.getText('content').toString()
        
        if (regex.test(content)) {
          // Find all matches in content
          const contentMatches = Array.from(content.matchAll(regex))
          matches.push(...contentMatches.map(match => ({
            type: 'content',
            text: match[0],
            index: match.index
          })))
        }
      }

      if (matches.length > 0) {
        return {
          id: document.id,
          title: document.title,
          matches
        }
      }
      return null
    }))

    const filteredResults = results.filter(Boolean)
    console.log('Found matches in documents:', filteredResults.length)

    res.status(200).json(filteredResults)
  } catch (error) {
    console.error('Error searching documents:', error)
    res.status(500).json({ error: 'Failed to search documents' })
  }
}) 