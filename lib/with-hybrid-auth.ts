import { Claims } from '@auth0/nextjs-auth0'
import { NextApiRequest, NextApiResponse } from 'next'

import { getSession, withApiAuthRequired } from '@wrappers/auth-wrapper'
import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'

export interface ExtendedApiRequest extends NextApiRequest {
  user?: Claims
}

const client = jwksClient({
  jwksUri: `${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`,
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
  // First try the direct authorization header
  let authHeader = req.headers.authorization
  // console.log('Direct authorization header:', authHeader ? 'found' : 'not found')

  // Then try custom header that might bypass Vercel's header handling
  if (!authHeader && req.headers['x-whetstone-authorization']) {
    authHeader = req.headers['x-whetstone-authorization'] as string
    console.log('Found custom x-whetstone-authorization header')
  }

  // Finally, try the Vercel SC headers as a last resort
  if (!authHeader && req.headers['x-vercel-sc-headers']) {
    try {
      const scHeaders = JSON.parse(req.headers['x-vercel-sc-headers'] as string)
      if (scHeaders['x-whetstone-authorization']) {
        authHeader = scHeaders['x-whetstone-authorization']
        console.log('Retrieved authorization from x-vercel-sc-headers custom header')
      }
    } catch (error) {
      console.error('Failed to parse x-vercel-sc-headers:', error)
    }
  }

  // console.log('Final authorization header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'none')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // console.log('Authorization header validation failed:', {
    //   exists: !!authHeader,
    //   startsWith: authHeader ? authHeader.startsWith('Bearer ') : false,
    //   value: authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
    // })
    return null
  }

  const token = authHeader.split(' ')[1]
  console.log('Successfully extracted token:', token.substring(0, 20) + '...')

  const decodedHeader = jwt.decode(token, { complete: true })
  console.log('Decoded token header:', decodedHeader?.header)

  if (!decodedHeader || typeof decodedHeader === 'string' || !decodedHeader.header.kid) {
    console.log('Token decode failed:', {
      hasDecodedHeader: !!decodedHeader,
      isString: typeof decodedHeader === 'string',
      hasKid: decodedHeader && typeof decodedHeader !== 'string' ? !!decodedHeader.header.kid : false,
    })
    throw new Error('Invalid token format')
  }

  console.log('Attempting to get public key with kid:', decodedHeader.header.kid)
  const publicKey = await getPublicKey(decodedHeader.header.kid)
  console.log('Retrieved public key successfully')

  try {
    const decodedUser = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      audience: 'https://www.whetstone-writer.com/api',
      issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`,
    }) as Claims
    console.log('Token verification successful')
    console.log('Verification options:', {
      audience: 'https://www.whetstone-writer.com/api',
      issuer: `${process.env.AUTH0_ISSUER_BASE_URL}/`,
    })

    if (!decodedUser) {
      console.log('No decoded user after verification')
      throw new Error('Invalid token payload')
    }

    return decodedUser
  } catch (error) {
    console.error('Token verification failed:', (error as Error).message)
    throw error
  }
}

const withHybridAuth = (
  handler: (req: ExtendedApiRequest, res: NextApiResponse) => Promise<void | Response>,
) => {
  return async (req: ExtendedApiRequest, res: NextApiResponse) => {
    try {
      const userFromToken = await extractBearerToken(req)
      if (userFromToken) {
        // token-based authentication
        console.log('found user from token, using token-based authentication')
        req.user = userFromToken
        return await handler(req, res)
      } else {
        // console.log('no user from token, using session-based authentication')
        const session = await getSession(req, res)
        req.user = session?.user
        if (!req.user) {
          console.log('no user from session, returning 401')
          return res.status(401).end('Unauthorized')
        }

        // session-based authentication
        // Wrap the handler to handle both void and Response returns
        const wrappedHandler = async (req: ExtendedApiRequest, res: NextApiResponse) => {
          const result = await handler(req, res)
          return result
        }

        return await withApiAuthRequired(wrappedHandler)(req, res)
      }
    } catch (error) {
      console.error('Authentication error:', (error as Error).message)
      return res.status(401).end('Unauthorized')
    }
  }
}

export default withHybridAuth
