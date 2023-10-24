const { contextBridge, ipcRenderer } = require("electron")

// API Definition
const electronAPI = {
  getProfile: () => ipcRenderer.invoke('auth:get-profile'),
  getDocuments: () => ipcRenderer.invoke('api:get-documents'),
  logOut: () => ipcRenderer.send('auth:log-out'),
}

// Register the API with the contextBridge
process.once("loaded", () => {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI)
})

export type ElectronAPI = typeof electronAPI