import fs from 'fs-extra'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { VersionData } from '@typez/globals'
import os from 'os'
import { randomUUID } from 'crypto'
import * as Y from 'yjs'

export class VersionStorage {
  private storagePath = ''
  private useFileStorage: boolean
  private docs: Map<string, Y.Doc> = new Map()

  constructor() {
    this.useFileStorage = process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'mongo'
    
    // Only set up file storage if we're not using mongo
    if (this.useFileStorage) {
      this.storagePath = process.env.NODE_ENV === 'production'
        ? path.join(os.tmpdir(), 'draft-editor-data')
        : (process.env.JSON_STORAGE_PATH || './data')
      
      console.log('\n=== VersionStorage Initialization ===')
      console.log('Environment:', process.env.NODE_ENV)
      console.log('Storage path:', this.storagePath)
      console.log('Storage type:', process.env.NEXT_PUBLIC_STORAGE_TYPE)
      
      this.initialize()
    }
  }

  private initialize() {
    if (!this.useFileStorage) return
    
    // Ensure the base versions directory exists
    const versionsPath = path.join(this.storagePath, 'versions')
    fs.ensureDirSync(versionsPath)
    console.log('Initialized versions directory:', versionsPath)
  }

  private getVersionsPath(documentId: string) {
    if (!this.useFileStorage) {
      throw new Error('File storage is not enabled')
    }
    const versionsPath = path.join(this.storagePath, 'versions', documentId)
    fs.ensureDirSync(versionsPath) // Ensure document's version directory exists
    return versionsPath
  }

  async getVersions(documentId: string): Promise<VersionData[]> {
    if (!this.useFileStorage) {
      return [] // In mongo mode, versions should be handled by mongo adapter
    }

    console.log('\n=== Getting versions for document ===')
    console.log('Document ID:', documentId)

    try {
      const versionsPath = this.getVersionsPath(documentId)
      const files = await fs.readdir(versionsPath)
      const versions = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(async file => {
            const filePath = path.join(versionsPath, file)
            const content = await fs.readFile(filePath, 'utf-8')
            const version = JSON.parse(content) as VersionData

            // Deserialize YJS content if present
            if (version.content?.type === 'yjs' && Array.isArray(version.content.state)) {
              console.log(`Deserializing YJS content for version: ${version.id}`)
              const ydoc = this.getYDoc(`${documentId}-${version.id}`) // Use unique ID for each version
              const state = new Uint8Array(version.content.state)
              Y.applyUpdate(ydoc, state)
              const ytext = ydoc.getText('content')
              const textContent = ytext.toString()
              console.log(`Version ${version.id} content length:`, textContent.length)
              
              return {
                ...version,
                content: textContent
              }
            }

            return version
          })
      )

      // Sort versions by creation date, newest first
      const sortedVersions = versions.sort((a, b) => b.createdAt - a.createdAt)
      console.log('Retrieved versions:', sortedVersions.map(v => ({
        id: v.id,
        contentLength: typeof v.content === 'string' ? v.content.length : 'non-string content',
        createdAt: v.createdAt
      })))

      return sortedVersions
    } catch (error) {
      console.error('Error reading versions:', error)
      return []
    }
  }

  private getYDoc(id: string): Y.Doc {
    let ydoc = this.docs.get(id)
    if (!ydoc) {
      ydoc = new Y.Doc()
      this.docs.set(id, ydoc)
    }
    return ydoc
  }

  async getVersion(documentId: string, versionId: string): Promise<VersionData | null> {
    if (!this.useFileStorage) {
      return null
    }

    console.log('\n=== Getting Version ===')
    console.log('Document ID:', documentId)
    console.log('Version ID:', versionId)

    try {
      const versionsPath = this.getVersionsPath(documentId)
      const filePath = path.join(versionsPath, `${versionId}.json`)
      
      if (!fs.existsSync(filePath)) {
        console.log('Version file not found:', filePath)
        return null
      }

      const content = await fs.readFile(filePath, 'utf-8')
      const version = JSON.parse(content) as VersionData
      console.log('Raw version data:', {
        id: version.id,
        documentId: version.documentId,
        contentType: typeof version.content,
        hasYjsState: version.content?.type === 'yjs' && Array.isArray(version.content.state),
        stateLength: version.content?.state?.length
      })
      
      // If the version has YJS content, deserialize it
      if (version.content?.type === 'yjs' && Array.isArray(version.content.state)) {
        console.log('Deserializing YJS state')
        const ydoc = this.getYDoc(documentId)
        const state = new Uint8Array(version.content.state)
        console.log('State array length:', state.length)
        
        Y.applyUpdate(ydoc, state)
        const ytext = ydoc.getText('content')
        const content = ytext.toString()
        console.log('Deserialized content length:', content.length)
        console.log('Deserialized content preview:', content.substring(0, 100))
        
        return {
          ...version,
          content
        }
      }

      console.log('Version does not contain YJS state, returning as-is')
      return version
    } catch (error) {
      console.error('Error reading version:', error)
      return null
    }
  }

  async createVersion(version: Omit<VersionData, 'id'>): Promise<VersionData> {
    if (!this.useFileStorage) {
      throw new Error('File storage is not enabled')
    }

    console.log('\n=== Creating Version ===')
    console.log('Document ID:', version.documentId)
    console.log('Input content type:', typeof version.content)
    console.log('Input content preview:', 
      typeof version.content === 'string' 
        ? version.content.substring(0, 100) 
        : JSON.stringify(version.content).substring(0, 100)
    )

    // Create YDoc for content
    const ydoc = this.getYDoc(version.documentId)
    const ytext = ydoc.getText('content')
    
    // Clear existing content and set new content
    ytext.delete(0, ytext.length)
    if (typeof version.content === 'string') {
      ytext.insert(0, version.content)
    } else if (version.content) {
      ytext.insert(0, JSON.stringify(version.content))
    }

    console.log('YJS text content after insert:', ytext.toString().substring(0, 100))
    const state = Y.encodeStateAsUpdate(ydoc)
    console.log('YJS state array length:', state.length)

    const newVersion: VersionData = {
      ...version,
      id: randomUUID(),
      content: {
        type: 'yjs',
        state: Array.from(state)
      }
    }

    const versionsPath = this.getVersionsPath(version.documentId)
    const filePath = path.join(versionsPath, `${newVersion.id}.json`)
    
    await fs.writeFile(filePath, JSON.stringify(newVersion, null, 2))
    console.log('Created version:', newVersion.id)
    console.log('Stored state array length:', (newVersion.content as any).state.length)

    // Return with readable content
    const readableContent = ytext.toString()
    console.log('Returning content preview:', readableContent.substring(0, 100))

    return {
      ...newVersion,
      content: readableContent
    }
  }

  async deleteVersion(documentId: string, versionId: string): Promise<boolean> {
    if (!this.useFileStorage) {
      return false
    }

    try {
      const versionsPath = this.getVersionsPath(documentId)
      const filePath = path.join(versionsPath, `${versionId}.json`)
      
      if (!fs.existsSync(filePath)) {
        return false
      }

      await fs.unlink(filePath)
      return true
    } catch (error) {
      console.error('Error deleting version:', error)
      return false
    }
  }

  generateId() {
    return randomUUID()
  }
} 