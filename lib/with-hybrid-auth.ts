import { Claims } from "@auth0/nextjs-auth0"
import { NextApiRequest, NextApiResponse } from "next"

import { getSession, withApiAuthRequired } from "@wrappers/auth-wrapper"
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

export interface ExtendedApiRequest extends NextApiRequest {
  user?: Claims
}

const client = jwksClient({
  jwksUri: `${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`
})

const getPublicKey = async (kid: string): Promise<string> => {
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

const extractBearerToken = async (req: ExtendedApiRequest): Promise<Claims | null> => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  
  const token = authHeader.split(' ')[1]
  const decodedHeader = jwt.decode(token, { complete: true })
  
  if (!decodedHeader || typeof decodedHeader === 'string' || !decodedHeader.header.kid) {
    throw new Error('Invalid token format')
  }
  
  const publicKey = await getPublicKey(decodedHeader.header.kid)
  const decodedUser = jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    audience: 'https://www.whetstone-writer.com/api',
    issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`
  }) as Claims

  if (!decodedUser) {
    throw new Error('Invalid token payload')
  }

  return decodedUser
}

const withHybridAuth = (handler: (req: ExtendedApiRequest, res: NextApiResponse) => Promise<void>) => {
  return async (req: ExtendedApiRequest, res: NextApiResponse) => {
    try {
      const userFromToken = extractBearerToken(req)

      if (userFromToken) {
        // token-based authentication
        req.user = userFromToken
        await handler(req, res)
      } else {
        const session = await getSession(req, res)
        req.user = session?.user
        
        if (!req.user) {
          return res.status(401).end('Unauthorized')
        }

        // session-based authentication
        await withApiAuthRequired(handler)(req, res)
      }
      
    } catch (error) {
      console.error('Authentication error:', (error as Error).message)
      return res.status(401).end('Unauthorized')
    }
  }
}

export default withHybridAuth