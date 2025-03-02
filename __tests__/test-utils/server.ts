import { spawn } from 'child_process'
import fetch from 'node-fetch'

let serverProcess: ReturnType<typeof spawn> | null = null

async function waitForHealthCheck(timeout = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch('http://localhost:3000/api/health')
      if (response.ok) {
        console.log('Health check passed')
        return
      }
    } catch (error) {
      // Ignore errors and keep trying
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  throw new Error('Server health check timeout')
}

export async function startTestServer(): Promise<void> {
  if (serverProcess) {
    console.log('Server is already running')
    return
  }

  console.log('Starting Next.js test server...')
  
  // Start the Next.js server with process group
  serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PORT: '3000',
      NODE_ENV: 'test'
    },
    detached: true
  })

  // Log server output for debugging
  serverProcess.stdout?.on('data', (data) => {
    console.log(`Server stdout: ${data}`)
  })

  serverProcess.stderr?.on('data', (data) => {
    console.error(`Server stderr: ${data}`)
  })

  // Wait for server to be ready
  try {
    await Promise.race([
      new Promise<void>((_, reject) => {
        serverProcess?.on('error', reject)
        serverProcess?.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Server process exited with code ${code}`))
          }
        })
      }),
      waitForHealthCheck()
    ])
    console.log('Next.js test server started and ready')
  } catch (error) {
    console.error('Failed to start server:', error)
    await stopTestServer()
    throw error
  }
}

export async function stopTestServer(): Promise<void> {
  if (!serverProcess) {
    console.log('No server process to stop')
    return
  }

  console.log('Stopping Next.js test server...')
  
  try {
    // Kill the server process and its children
    if (process.platform === 'win32') {
      if (serverProcess.pid) {
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t'])
      }
    } else {
      // Kill the entire process group
      if (serverProcess.pid) {
        process.kill(-serverProcess.pid)
      }
    }
  } catch (error) {
    console.error('Error killing server process:', error)
  } finally {
    serverProcess = null
    // Give some time for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log('Next.js test server stopped')
  }
} 