import { UserContext, UserProfile } from '@auth0/nextjs-auth0/client'
import { NextApiRequest, NextApiResponse } from 'next'
import { FC, ReactNode, createContext } from 'react'

export const mockUser: UserProfile = {
  name: 'Mock User',
  email: 'mockuser@example.com',
  picture: 'https://mock.image.url',
  sub: 'mock|12345',
}

const userContext: UserContext = {
  user: mockUser,
  error: undefined,
  isLoading: false,
  checkSession: async () => {},
}

export const useUser = () => {
  return userContext
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

export const withPageAuthRequired = (WrappedComponent: React.FC) => {
  const AuthWrapper: React.FC = props => {
    return <WrappedComponent {...props} />
  }
  return AuthWrapper
}

// Context and Providers
const MockUserContext = createContext<UserContext>(userContext)

type Props = {
  children: ReactNode
}

export const MockUserProvider: FC<Props> = ({ children }) => (
  <MockUserContext.Provider value={userContext}>{children}</MockUserContext.Provider>
)
