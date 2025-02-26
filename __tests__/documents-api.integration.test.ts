import axios from 'axios'
import { Doc } from '@lib/mongo-models'
import { mockUser } from '../lib/mock-auth'
import * as Y from 'yjs'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const API_URL = 'http://localhost:3000/api'

async function isPortInUse(port: number): Promise<boolean> {
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

async function killServer() {
  if (!await isPortInUse(3000)) return

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('netstat -ano | findstr :3000')
      const match = stdout.match(/\s+(\d+)\s*$/m)
      if (match) {
        const pid = match[1]
        console.log(`Cleaning up server process ${pid}...`)
        await execAsync(`taskkill /F /PID ${pid}`)
      }
    } else {
      try {
        const { stdout } = await execAsync('lsof -i :3000 -t')
        if (stdout.trim()) {
          const pid = stdout.trim()
          console.log(`Cleaning up server process ${pid}...`)
          try {
            await execAsync(`kill ${pid}`)
            await new Promise(resolve => setTimeout(resolve, 1000))
          } catch {
            await execAsync(`kill -9 ${pid}`)
          }
        }
      } catch {
        try {
          const { stdout } = await execAsync('fuser 3000/tcp')
          if (stdout.trim()) {
            const pid = stdout.trim()
            console.log(`Cleaning up server process ${pid}...`)
            await execAsync(`kill -9 ${pid}`)
          }
        } catch {
          // Ignore if no process found
        }
      }
    }

    // Verify cleanup
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (await isPortInUse(3000)) {
      console.warn('Warning: Port 3000 still in use after cleanup attempt')
    }
  } catch (error) {
    console.error('Error during server cleanup:', error)
  }
}

describe('Documents API Integration Tests', () => {
  // Ensure server cleanup happens after all tests, regardless of outcome
  afterAll(async () => {
    await killServer()
    // Give extra time for process cleanup
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, 15000)

  describe('GET /api/documents', () => {
    beforeEach(async () => {
      // Clear the documents collection before each test
      await Doc.deleteMany({})
    }, 10000)

    afterAll(async () => {
      // Clean up all test data
      await Doc.deleteMany({})
    }, 10000)

    it('should return all documents with content when metadataOnly is not set', async () => {
      // Create a proper YJS document state
      const ydoc = new Y.Doc()
      const ytext = ydoc.getText('content')
      ytext.insert(0, 'Test content')
      const state = Y.encodeStateAsUpdate(ydoc)

      // Create a test document with proper YJS state
      const testDoc = await Doc.create({
        title: 'Test Doc',
        content: {
          type: 'yjs',
          state: Array.from(state)
        },
        userId: mockUser.sub
      })

      const response = await axios.get(`${API_URL}/documents`)
      
      const data = response.data
      expect(data).toHaveLength(1)
      expect(data[0]).toHaveProperty('content')
      expect(data[0].content).toBe('Test content')
      expect(data[0].id).toBe(testDoc._id.toString())
      expect(data[0].title).toBe('Test Doc')
    }, 10000)

    it('should return documents without content when metadataOnly=true', async () => {
      // Create a proper YJS document state
      const ydoc = new Y.Doc()
      const ytext = ydoc.getText('content')
      ytext.insert(0, 'Test content')
      const state = Y.encodeStateAsUpdate(ydoc)

      // Create a test document with proper YJS state
      const testDoc = await Doc.create({
        title: 'Test Doc',
        content: {
          type: 'yjs',
          state: Array.from(state)
        },
        userId: mockUser.sub
      })

      const response = await axios.get(`${API_URL}/documents?metadataOnly=true`)
      
      const data = response.data
      expect(data).toHaveLength(1)
      expect(data[0].content).toBeUndefined()
      expect(data[0].id).toBe(testDoc._id.toString())
      expect(data[0].title).toBe('Test Doc')
    }, 10000)

    it('should handle empty document list', async () => {
      const response = await axios.get(`${API_URL}/documents`)
      expect(response.data).toHaveLength(0)
    }, 10000)
  })
}) 