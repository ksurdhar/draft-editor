import { Claims } from "@auth0/nextjs-auth0"
import { createDocument, createPermission, getDocuments } from "@lib/mongo-utils"
import { DocumentData } from '@typez/globals'
import { getSession, withApiAuthRequired } from '@wrappers/auth-wrapper'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import type { NextApiRequest, NextApiResponse } from 'next'

const client = jwksClient({
  jwksUri: `${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`
})

const getSigningKeyAsync = async (kid: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err || !key) {
        reject(err)
        return
      }

      resolve(key.getPublicKey())
    })
  })
}

export default withApiAuthRequired(async function documentsHandler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization

  let user: Claims | undefined 
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    const decodedHeader = jwt.decode(token, { complete: true })
    
    if (!decodedHeader || typeof decodedHeader === 'string' || !decodedHeader.header.kid) {
      return res.status(401).end('Invalid token')
    }
    
    try {
      const publicKey = await getSigningKeyAsync(decodedHeader.header.kid)
      const decoded = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        audience: 'https://www.whetstone-writer.com/api',
        issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`
      }) as Claims
  
      user = decoded
    } catch (error) {
      console.error('Error verifying token:', error)
      return res.status(401).end('Unauthorized')
    }
  } else {
    const session = await getSession(req, res)
    user = session?.user
  }
  if (!user) return res.status(401).end('Unauthorized')
  console.log('USER FOUND', user)
  const { method } = req

  switch (method) {
    case 'POST': 
      const newDocument = await createDocument(req.body)
      await createPermission({ ownerId: user.sub, documentId: newDocument.id })
      res.status(200).json(newDocument)
      break
    case 'GET':
      const documents = await getDocuments(user.sub)
      const docsWithPermissions = documents.map(doc => {
        doc.canEdit = true
        doc.canComment = true
        return doc
      })
      res.status(200).json(docsWithPermissions as DocumentData[])
    
      break
    default:
      res.setHeader('Allow', ['GET', 'POST'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})