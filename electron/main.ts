import { BrowserWindow, app, ipcMain } from 'electron'
import apiService from './api-service'
import { createAppWindow } from './app'
import { createAuthWindow, createLogoutWindow } from './auth-process'
import authService from './auth-service'

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  try {
    // if previously authorized, get refresh tokens
    await authService.refreshTokens()
    mainWindow = await createAppWindow()
  } catch (err) {
    await createAuthWindow()
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
    ipcMain.on('auth:log-out', () => {
      BrowserWindow.getAllWindows().forEach((window) => window.close())
      createLogoutWindow()
    })
    createWindow()
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow()
    })
  })
  .catch(console.log)