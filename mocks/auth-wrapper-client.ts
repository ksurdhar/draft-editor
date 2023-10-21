import { UserProvider as RealUserProvider, useUser as realUseUser, withPageAuthRequired as realWithPageAuthRequired } from '@auth0/nextjs-auth0/client'
import * as mockAuth from './auth0-mocks-client'

const isAuthMocked = process.env.MOCK_AUTH === 'true'

export function useUser() {
  if (isAuthMocked) {
    return mockAuth.useUser()
  }
  return realUseUser()
}

export function withPageAuthRequired(reactCmp: any) {
  if (isAuthMocked) {
    return mockAuth.withPageAuthRequired(reactCmp)
  }
  return realWithPageAuthRequired(reactCmp)
}

export const UserProvider = isAuthMocked ? mockAuth.MockUserProvider : RealUserProvider
