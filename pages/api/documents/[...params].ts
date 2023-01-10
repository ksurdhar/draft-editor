import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0'
import type { NextApiRequest, NextApiResponse } from 'next'
import { createVersion, getVersionsForDoc } from '../../../lib/mongoUtils'
import { VersionData } from '../../../types/globals'

export default withApiAuthRequired(async function nestedDocumentsHandler(req: NextApiRequest, res: NextApiResponse) {
  const { query, method  } = req
  const session = getSession(req, res)
  const documentId = query.params[0]

  // /documents/123/versions GET
  // /documents/123/versions POST
  
  switch (method) {
    case 'POST':  
      const newVersion = await createVersion(req.body)
      res.status(200).json(newVersion)
      break
    case 'GET':
      if (session) {
        const versions = await getVersionsForDoc(documentId)
        res.status(200).json(versions as VersionData[])
      }
      break
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})