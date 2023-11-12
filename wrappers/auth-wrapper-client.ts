import {
  UserProvider as RealUserProvider,
  useUser as realUseUser,
  withPageAuthRequired as realWithPageAuthRequired,
} from '@auth0/nextjs-auth0/client'
import env from '../lib/env'
import * as mockAuth from './auth0-mocks-client'

export function useUser() {
  if (env.MOCK_AUTH) {
    return mockAuth.useUser()
  }
  return realUseUser()
}

export function withPageAuthRequired(reactCmp: any) {
  if (env.MOCK_AUTH) {
    return mockAuth.withPageAuthRequired(reactCmp)
  }
  return realWithPageAuthRequired(reactCmp)
}

export const UserProvider = env.MOCK_AUTH ? mockAuth.MockUserProvider : RealUserProvider
