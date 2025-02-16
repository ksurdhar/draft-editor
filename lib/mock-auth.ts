import { UserProfile } from '@auth0/nextjs-auth0/client'

export const mockUser: UserProfile = {
  name: 'Mock User',
  email: 'mockuser@example.com',
  picture: 'https://mock.image.url',
  sub: 'mock|12345',
}

export const getMockToken = () => 'mock-token' 