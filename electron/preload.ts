import { DocumentData } from '@typez/globals'
const { contextBridge, ipcRenderer } = require('electron')

// API Definition
const electronAPI = {
  getProfile: () => ipcRenderer.invoke('auth:get-profile'),
  getDocuments: () => ipcRenderer.invoke('api:get-documents'),
  deleteDocument: (id: string) => ipcRenderer.invoke('api:delete-document', id),
  renameDocument: (id: string, data: Partial<DocumentData>) =>
    ipcRenderer.invoke('api:rename-document', id, data),
  logOut: () => ipcRenderer.send('auth:log-out'),
}

// Register the API with the contextBridge
process.once('loaded', () => {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
  contextBridge.exposeInMainWorld('env', {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
  })
})

export type ElectronAPI = typeof electronAPI
