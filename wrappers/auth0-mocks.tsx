import { Session } from '@auth0/nextjs-auth0'
import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'
import { mockUser } from './auth0-mocks-client'

const mockSession: Session = {
  user: mockUser,
}

// this mock effectively becomes middleware that can be used to supply necessary data
// as well as handle redirects in the case of signout which relies on auth0 for navigation
export const handleAuth = () => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    
    if (req.url === '/api/auth/logout') {
      res.redirect('/')
    }

    res.status(200).json(mockUser)
  }
}

export const getSession = (req: NextApiRequest, res: NextApiResponse): Session => ({ user: mockUser })

export const withApiAuthRequired = (handler: NextApiHandler): NextApiHandler => (req, res) => {
  (req as any).session = mockSession
  return handler(req, res)
}