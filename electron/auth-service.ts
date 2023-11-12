import axios from 'axios'
import * as crypto from 'crypto'
import { randomBytes } from 'crypto'
import * as fs from 'fs'
import jwtDecode from 'jwt-decode'
import * as os from 'os'
import * as path from 'path'
import * as url from 'url'
import tokenStore from './token-store'

const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))

const apiIdentifier = env.NEXT_PUBLIC_BASE_URL + '/api'
const auth0Domain = env.AUTH0_DOMAIN
const clientId = env.CLIENT_ID

const redirectUri = 'http://localhost/callback*'

function base64URLEncode(buffer: Buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

const verifier = base64URLEncode(randomBytes(32))
const tokenStoreKey = 'whetstone-' + os.userInfo().username

function sha256(buffer: string) {
  return crypto.createHash('sha256').update(buffer).digest()
}
const challenge = base64URLEncode(sha256(verifier))

let accessToken: string = ''
let profile: any = null
let refreshToken: string = ''

function getAccessToken() {
  return accessToken
}

function getProfile() {
  return profile
}

function getAuthenticationURL() {
  return (
    'https://' +
    auth0Domain +
    '/authorize?' +
    'audience=' +
    apiIdentifier +
    '&' +
    'scope=openid profile offline_access&' +
    'response_type=code&' +
    'code_challenge=' +
    challenge +
    '&' +
    'code_challenge_method=S256&' +
    'client_id=' +
    clientId +
    '&' +
    'redirect_uri=' +
    redirectUri
  )
}

async function refreshTokens() {
  const refreshToken = await tokenStore.getToken(tokenStoreKey)

  if (!refreshToken) throw new Error('no refresh token available')

  const refreshOptions = {
    method: 'POST',
    url: `https://${auth0Domain}/oauth/token`,
    headers: { 'content-type': 'application/json' },
    data: {
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    },
  }

  try {
    const response = await axios(refreshOptions)
    accessToken = response.data.access_token
    profile = jwtDecode(response.data.id_token)
  } catch (error) {
    await logout()

    throw error
  }
}

async function loadTokens(callbackURL: string) {
  const urlParts = url.parse(callbackURL, true)
  const query = urlParts.query

  const exchangeOptions = {
    grant_type: 'authorization_code',
    client_id: clientId,
    code_verifier: verifier,
    code: query.code,
    redirect_uri: redirectUri,
  }

  const options = {
    method: 'POST',
    url: `https://${auth0Domain}/oauth/token`,
    headers: {
      'content-type': 'application/json',
    },
    data: JSON.stringify(exchangeOptions),
  }

  try {
    const response = await axios(options)

    accessToken = response.data.access_token
    profile = jwtDecode(response.data.id_token)
    refreshToken = response.data.refresh_token

    if (refreshToken) {
      await tokenStore.setToken(tokenStoreKey, refreshToken)
    }
  } catch (error) {
    await logout()

    throw error
  }
}

async function logout() {
  await tokenStore.deleteToken(tokenStoreKey)
  accessToken = ''
  profile = null
  refreshToken = ''
}

function getLogOutUrl() {
  return `https://${auth0Domain}/v2/logout`
}

function isTokenExpired(token: string, bufferTime = 300): boolean {
  try {
    const decoded: any = jwtDecode(token)
    const currentTime = Math.floor(Date.now() / 1000) // Current time in seconds
    // If the token is expired or is going to expire in the next 'bufferTime' seconds
    if (decoded.exp < currentTime + bufferTime) {
      return true
    }
    return false
  } catch (error) {
    console.error('Error decoding token:', error)
    return true
  }
}

// Usage example:
// if (isTokenExpired(accessToken)) {
//   await refreshTokens();
// }

const authService = {
  getAccessToken,
  getAuthenticationURL,
  getLogOutUrl,
  getProfile,
  loadTokens,
  logout,
  refreshTokens,
}
export default authService
