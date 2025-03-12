import * as realAuth from '@auth0/nextjs-auth0'
import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import * as mockAuth from './auth0-mocks'

const isAuthMocked = process.env.MOCK_AUTH === 'true'

export function handleAuth() {
  if (isAuthMocked) {
    return mockAuth.handleAuth()
  }
  return realAuth.handleAuth()
}

export function getSession(req: NextApiRequest, res: NextApiResponse) {
  if (isAuthMocked) {
    return mockAuth.getSession(req, res)
  }
  return realAuth.getSession(req, res)
}

export function withApiAuthRequired(handler: NextApiHandler) {
  if (isAuthMocked) {
    return mockAuth.withApiAuthRequired(handler)
  }
  return realAuth.withApiAuthRequired(handler)
}
