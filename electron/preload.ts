import { contextBridge, ipcRenderer } from 'electron'

// API Definition
const electronAPI = {
  getProfile: () => ipcRenderer.invoke('auth:get-profile'),
  getDocuments: () => ipcRenderer.invoke('api:get-documents'),
  deleteDocument: (id: string) => ipcRenderer.invoke('api:delete-document', id),
  renameDocument: (id: string, data: any) => ipcRenderer.invoke('api:rename-document', id, data),
  createDocument: (data: any) => ipcRenderer.invoke('api:create-document', data),
  post: (url: string, body: any) => ipcRenderer.invoke('api:post', url, body),
  patch: (url: string, body: any) => ipcRenderer.invoke('api:patch', url, body),
  get: (url: string) => ipcRenderer.invoke('api:get', url),
  destroy: (url: string) => ipcRenderer.invoke('api:delete', url),
  logOut: () => ipcRenderer.send('auth:log-out'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:open-folder'),
  getNetworkStatus: () => ipcRenderer.invoke('network:get-status'),
  onNetworkStatusChanged: (callback: (isOnline: boolean) => void) => {
    const listener = (_: any, isOnline: boolean) => callback(isOnline)
    ipcRenderer.on('network:status-changed', listener)
    return () => {
      ipcRenderer.removeListener('network:status-changed', listener)
    }
  },
  onSyncUpdate: (callback: (updates: { documents?: any[]; folders?: any[] }) => void) => {
    const listener = (_: any, updates: any) => callback(updates)
    ipcRenderer.on('sync:updates', listener)
    return () => {
      ipcRenderer.removeListener('sync:updates', listener)
    }
  },
}

// Register the API with the contextBridge
process.once('loaded', () => {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  contextBridge.exposeInMainWorld('env', {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  })
})

export type ElectronAPI = typeof electronAPI
