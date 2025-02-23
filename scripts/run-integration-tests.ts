import { spawn, ChildProcess, exec } from 'child_process'
import { promisify } from 'util'
import * as dotenv from 'dotenv'
import * as path from 'path'

const execAsync = promisify(exec)
let server: ChildProcess | null = null

// Load environment variables from .env.local
const envConfig = {
  ...dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }).parsed,
  NODE_ENV: 'test' as const,
  DEBUG: 'false',
  LOG_LEVEL: 'error',
  MOCK_AUTH: 'true',
  NEXT_PUBLIC_STORAGE_TYPE: 'mongo'
}

// Get test pattern from command line arguments
const testPattern = process.argv.slice(2).join(' ') || '**/*.integration.test.ts'
console.log('\n=== Running Integration Tests ===')
console.log('Test pattern:', testPattern)

async function killProcessOnPort(port: number): Promise<void> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
      const match = stdout.match(/\s+(\d+)\s*$/m)
      if (match) {
        const pid = match[1]
        await execAsync(`taskkill /F /PID ${pid}`)
      }
    } else {
      try {
        const { stdout } = await execAsync(`lsof -i :${port} -t`)
        if (stdout.trim()) {
          await execAsync(`kill -9 ${stdout.trim()}`)
        }
      } catch {
        try {
          const { stdout } = await execAsync(`fuser ${port}/tcp`)
          if (stdout.trim()) {
            await execAsync(`kill -9 ${stdout.trim()}`)
          }
        } catch {
          // Ignore if no process found
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  } catch {
    // Ignore errors if process not found
  }
}

async function waitForServer(timeout = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      fetch('http://localhost:3000/api/health')
        .then(() => resolve(true))
        .catch(() => {
          if (Date.now() - start > timeout) {
            console.error('Server failed to start within', timeout, 'ms')
            resolve(false)
          } else {
            setTimeout(check, 1000)
          }
        })
    }
    check()
  })
}

async function startServer(): Promise<boolean> {
  try {
    // Kill any existing process on port 3000
    await killProcessOnPort(3000)
    
    const env = {
      ...process.env,
      ...envConfig,
      LOCAL_DB: 'false',
      PORT: '3000'
    } as NodeJS.ProcessEnv

    server = spawn('npm', ['run', 'dev'], {
      env,
      stdio: process.platform === 'win32' ? 'pipe' : ['ignore', 'ignore', 'ignore']
    })

    // Wait for server to be ready
    return await waitForServer()
  } catch (error) {
    console.error('Failed to start server:', error)
    return false
  }
}

async function runTests(): Promise<number> {
  const env = {
    ...process.env,
    ...envConfig,
    LOCAL_DB: 'false'
  } as NodeJS.ProcessEnv

  return new Promise((resolve, reject) => {
    console.log('Running integration tests...')
    const jest = spawn('jest', ['--runInBand', '--testMatch', testPattern], {
      env,
      stdio: 'inherit'
    })

    jest.on('exit', (code) => {
      resolve(code ?? 1)
    })

    jest.on('error', (err) => {
      reject(err)
    })
  })
}

function stopServer() {
  if (server) {
    console.log('Stopping Next.js server...')
    server.kill('SIGTERM')
    
    setTimeout(() => {
      if (server) {
        server.kill('SIGKILL')
        server = null
      }
    }, 5000)
  }
}

async function main() {
  try {
    const serverStarted = await startServer()
    if (!serverStarted) {
      throw new Error('Failed to start test server')
    }
    const testResult = await runTests()
    stopServer()
    process.exit(testResult)
  } catch (error) {
    console.error('Test runner failed:', error)
    stopServer()
    process.exit(1)
  }
}

// Handle cleanup on process termination
process.on('SIGTERM', stopServer)
process.on('SIGINT', stopServer)

// Ensure cleanup on uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
  stopServer()
  process.exit(1)
})

main() 