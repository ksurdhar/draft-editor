import { safeStorage } from 'electron'
import Store from 'electron-store'

const store = new Store<Record<string, string>>({
  name: 'ray-encrypted',
  watch: true,
})

const tokenStore = {
  setToken(key: string, token: string) {
    const buffer = safeStorage.encryptString(token)
    store.set(key, buffer.toString('base64'))
  },

  deleteToken(key: string) {
    store.delete(key)
  },

  getToken(key:string) {
    const buffer = store.get(key)
    return safeStorage.decryptString(Buffer.from(buffer, 'base64'))
  },
}

export default tokenStore