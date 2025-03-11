import { BrowserWindow, app, ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import apiService, { setNetworkDetector } from './api-service'
import { initNetworkDetection } from './network-detector'
import { createAppWindow } from './app'
import { createAuthWindow, createLogoutWindow } from './auth-process'
import authService from './auth-service'

let mainWindow: BrowserWindow | null = null

const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const mockAuth = env.MOCK_AUTH || false

let currentNetworkStatus = true
let networkDetector: {
  checkNow: () => void
  reportNetworkFailure: () => void
  reportNetworkSuccess: () => void
} | null = null

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
    // Initialize network detection
    networkDetector = initNetworkDetection()

    // Connect the network detector to the API service
    if (networkDetector) {
      setNetworkDetector(networkDetector)
    }

    // Set up additional network check on app resume
    app.on('activate', () => {
      // Check network on app activation/resume
      if (networkDetector) networkDetector.checkNow()
    })

    // Listen for network status changes from the API service
    ipcMain.on('network-status-changed', isOnline => {
      const previousStatus = currentNetworkStatus
      currentNetworkStatus = !!isOnline

      // Broadcast to all windows
      BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('network:status-changed', currentNetworkStatus)
        }
      })

      // If we're transitioning from offline to online, trigger a sync
      if (!previousStatus && currentNetworkStatus) {
        console.log('Network restored: triggering sync')
        // Trigger sync for documents and folders
        apiService.get('documents').catch(err => console.error('Error syncing documents:', err))
        apiService.get('folders').catch(err => console.error('Error syncing folders:', err))
      }
    })

    // Handle IPC messages from the renderer process.
    ipcMain.handle('network:get-status', () => currentNetworkStatus)
    ipcMain.handle('auth:get-profile', authService.getProfile)
    ipcMain.handle('api:get-documents', apiService.getDocuments)
    ipcMain.handle('api:delete-document', (_, id) => apiService.deleteDocument(id))
    ipcMain.handle('api:rename-document', (_, id, data) => apiService.updateDocument(id, data))
    ipcMain.handle('api:create-document', (_, data) => apiService.post('documents', data))
    ipcMain.handle('api:post', (_, url, body) => apiService.post(url, body))
    ipcMain.handle('api:patch', (_, url, body) => apiService.patch(url, body))
    ipcMain.handle('api:delete', (_, url) => apiService.destroy(url))
    ipcMain.handle('api:get', (_, url) => apiService.get(url))
    ipcMain.handle('dialog:open-folder', async () => {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'multiSelections'],
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
