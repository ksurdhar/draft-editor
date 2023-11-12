const isBrowser = typeof window !== 'undefined'
const isElectron = isBrowser && window.hasOwnProperty('electronAPI')

const env = {
  BASE_URL: isElectron ? window.env.BASE_URL : process.env.NEXT_PUBLIC_BASE_URL,
  MOCK_AUTH: isElectron ? window.env.MOCK_AUTH : process.env.NEXT_PUBLIC_MOCK_AUTH,
}

export default env
