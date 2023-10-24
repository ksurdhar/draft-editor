import { BrowserWindow } from 'electron'
import { createAppWindow } from './app'
import authService from './auth-service'

let win: BrowserWindow | null = null

export const createAuthWindow = async () => {
  destroyAuthWin()

  win = new BrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
    }
  })

  win.loadURL(authService.getAuthenticationURL())

  const { session: { webRequest } } = win.webContents

  const filter = {
    urls: [
      'http://localhost/callback*'
    ]
  }

  webRequest?.onBeforeRequest(filter, async ({ url }) => {
    await authService.loadTokens(url)
    createAppWindow()
    return destroyAuthWin()
  });

  (win as any).on('authenticated', () => {
    destroyAuthWin()
  })

  win.on('closed', () => {
    win = null
  })
}

function destroyAuthWin() {
  if (!win) return
  win.close()
  win = null
}

export const createLogoutWindow = () => {
  const logoutWindow = new BrowserWindow({
    show: false,
  })

  logoutWindow.loadURL(authService.getLogOutUrl())

  logoutWindow.on('ready-to-show', async () => {
    await authService.logout()
    logoutWindow.close()
    // optionally create window here
  })
}
