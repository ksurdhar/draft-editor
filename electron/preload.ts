import { DocumentData } from '@typez/globals'
const { contextBridge, ipcRenderer } = require('electron')

// API Definition
const electronAPI = {
  getProfile: () => ipcRenderer.invoke('auth:get-profile'),
  getDocuments: () => ipcRenderer.invoke('api:get-documents'),
  deleteDocument: (id: string) => ipcRenderer.invoke('api:delete-document', id),
  renameDocument: (id: string, data: any) => ipcRenderer.invoke('api:rename-document', id, data),
  post: (url: string, body: any) => ipcRenderer.invoke('api:post', url, body),
  patch: (url: string, body: any) => ipcRenderer.invoke('api:patch', url, body),
  get: (url: string) => ipcRenderer.invoke('api:get', url),
  destroy: (url: string) => ipcRenderer.invoke('api:delete', url),
  logOut: () => ipcRenderer.send('auth:log-out'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:open-folder')
}

// Register the API with the contextBridge
process.once('loaded', () => {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  contextBridge.exposeInMainWorld('env', {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  })
})

export type ElectronAPI = typeof electronAPI
