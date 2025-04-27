import { BrowserWindow, app, ipcMain, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import apiService, { setNetworkDetector, BASE_URL, isNetworkError } from './api-service'
import { initNetworkDetection, isOnline } from './network-detector'
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

async function streamCloudChatResponse(endpoint: string, data: any, messageId: string) {
  console.log('Setting up chat streaming from cloud API:', endpoint)

  try {
    // Get fresh access token
    let token = authService.getAccessToken()

    // If token is expired, refresh it
    if (token && authService.isTokenExpired(token)) {
      console.log('Token expired, refreshing before streaming...')
      await authService.refreshTokens()
      token = authService.getAccessToken()
    }

    if (!token) {
      throw new Error('No authentication token available. Please log in.')
    }

    // Ensure endpoint is properly formatted
    endpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    const url = `${BASE_URL}${endpoint}`

    console.log('Using Node.js native http/https module for streaming request')

    // Get reference to all browser windows
    const windows = BrowserWindow.getAllWindows()

    // Create and execute the request using node's http/https modules
    return new Promise((resolve, reject) => {
      try {
        // Parse the URL to get hostname, path, etc.
        const parsedUrl = new URL(url)

        // Prepare the request data
        const requestData = JSON.stringify(data)

        // Configure the request options
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'x-whetstone-authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData),
          },
        }

        console.log('Request details:', {
          url,
          method: 'POST',
          dataSize: requestData.length,
        })

        // Choose http or https module based on the URL
        const httpModule = parsedUrl.protocol === 'https:' ? require('https') : require('http')

        // Create the request
        const req = httpModule.request(options, (res: any) => {
          console.log('Response received. Status:', res.statusCode)
          console.log('Response headers:', res.headers)

          // Handle error status codes
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const errorMsg = `Request failed with status code ${res.statusCode}`
            console.error(errorMsg)

            // Notify windows of the error
            windows.forEach(window => {
              if (!window.isDestroyed()) {
                window.webContents.send('chat:stream', {
                  messageId,
                  error: errorMsg,
                  done: true,
                })
              }
            })

            // Clean up and reject the promise
            res.resume() // Consume the response data to free up memory
            reject(new Error(errorMsg))
            return
          }

          // Set up variables to collect the response
          let fullText = ''
          res.setEncoding('utf8')

          // Handle data chunks
          res.on('data', (chunk: string) => {
            console.log(`Received chunk of length: ${chunk.length}`)
            fullText += chunk

            // Send the chunk to all renderer windows
            windows.forEach(window => {
              if (!window.isDestroyed()) {
                window.webContents.send('chat:stream', {
                  messageId,
                  chunk,
                  done: false,
                })
              }
            })
          })

          // Handle end of response
          res.on('end', () => {
            console.log(`Response complete. Total length: ${fullText.length}`)

            // Send completion to all renderer windows
            windows.forEach(window => {
              if (!window.isDestroyed()) {
                window.webContents.send('chat:stream', {
                  messageId,
                  chunk: '',
                  done: true,
                  fullText,
                })
              }
            })

            // Report network success if needed
            if (networkDetector && !isOnline()) {
              networkDetector.reportNetworkSuccess()
            }

            resolve({ data: 'Streaming completed successfully' })
          })
        })

        // Handle request errors
        req.on('error', (err: Error) => {
          console.error('Request error:', err.message)

          // Notify windows of the error
          windows.forEach(window => {
            if (!window.isDestroyed()) {
              window.webContents.send('chat:stream', {
                messageId,
                error: err.message,
                done: true,
              })
            }
          })

          // Report network failure if appropriate
          if (networkDetector) {
            networkDetector.reportNetworkFailure()
          }

          reject(err)
        })

        // Send the request data
        req.write(requestData)
        req.end()

        console.log('Request sent, awaiting response...')
      } catch (err: any) {
        console.error('Error creating request:', err.message)
        reject(err)
      }
    })
  } catch (error: any) {
    console.error('Error setting up streaming:', error)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
    })

    // Report network failure if applicable
    if (isNetworkError(error) && networkDetector) {
      networkDetector.reportNetworkFailure()
    }

    // Notify all windows of the setup error
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('chat:stream', {
          messageId,
          error: error.message || 'Failed to set up streaming',
          done: true,
        })
      }
    })

    throw error
  }
}

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
    ipcMain.handle('api:post', (_, url, body) => apiService.post(url, body))
    ipcMain.handle('api:patch', (_, url, body) => apiService.patch(url, body))
    ipcMain.handle('api:delete', (_, url) => apiService.destroy(url))
    ipcMain.handle('api:get', (_, url) => apiService.get(url))

    // Add dedicated handler for chat streaming
    ipcMain.handle('api:stream-chat', async (_, payload) => {
      try {
        console.log('Starting chat stream with payload:', {
          messages: payload.messages?.length || 0,
          entityContents: Object.keys(payload.entityContents || {}).length || 0,
        })

        // Make sure there's a message ID
        const messageId = payload.messageId || `ai-${Date.now()}`

        // Start the streaming process (this doesn't return the stream)
        await streamCloudChatResponse('/dialogue/chat', payload, messageId)

        // Return success (the actual content comes via IPC events)
        return { success: true }
      } catch (error: any) {
        console.error('Error streaming chat:', error)
        return { success: false, error: error.message }
      }
    })

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
