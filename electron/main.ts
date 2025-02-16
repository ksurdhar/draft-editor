import { BrowserWindow, app, ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import apiService from './api-service'
import { createAppWindow } from './app'
import { createAuthWindow, createLogoutWindow } from './auth-process'
import authService from './auth-service'

let mainWindow: BrowserWindow | null = null

const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const mockAuth = env.MOCK_AUTH || false

async function createWindow() {
  try {
    if (mockAuth) {
      // Skip auth in mock mode
      mainWindow = await createAppWindow()
    } else {
      // Normal auth flow
      await authService.refreshTokens()
      mainWindow = await createAppWindow()
    }
  } catch (err) {
    if (!mockAuth) {
      await createAuthWindow()
    } else {
      mainWindow = await createAppWindow()
    }
  }
}

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app
  .whenReady()
  .then(() => {
    // Handle IPC messages from the renderer process.
    ipcMain.handle('auth:get-profile', authService.getProfile)
    ipcMain.handle('api:get-documents', apiService.getDocuments)
    ipcMain.handle('api:delete-document', (_, id) => apiService.deleteDocument(id))
    ipcMain.handle('api:rename-document', (_, id, data) => apiService.updateDocument(id, data))
    ipcMain.handle('api:post', (_, url, body) => apiService.post(url, body))
    ipcMain.handle('api:patch', (_, url, body) => apiService.patch(url, body))
    ipcMain.handle('api:delete', (_, url) => apiService.destroy(url))
    ipcMain.handle('api:get', (_, url) => apiService.get(url))
    ipcMain.handle('dialog:open-folder', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'multiSelections']
      })
      return result.filePaths
    })
    ipcMain.on('auth:log-out', () => {
      BrowserWindow.getAllWindows().forEach(window => window.close())
      createLogoutWindow()
    })
    createWindow()
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow()
    })
  })
  .catch(console.trace)
