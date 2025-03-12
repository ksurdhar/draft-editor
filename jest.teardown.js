const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

async function isPortInUse(port) {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
      return stdout.includes(`:${port}`)
    } else {
      const { stdout } = await execAsync(`lsof -i :${port} -t`)
      return !!stdout.trim()
    }
  } catch {
    return false
  }
}

async function killProcess(port) {
  if (!(await isPortInUse(port))) return

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
      const match = stdout.match(/\s+(\d+)\s*$/m)
      if (match) {
        await execAsync(`taskkill /F /PID ${match[1]}`)
      }
    } else {
      // Try both lsof and fuser
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
  } catch {
    // Ignore errors if process not found
  }
}

module.exports = async () => {
  // Kill any process on port 3000
  await killProcess(3000)

  // Give time for processes to fully terminate
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Force exit after cleanup
  process.exit(0)
}
