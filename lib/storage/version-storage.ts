import fs from 'fs-extra'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { VersionData } from '@typez/globals'
import os from 'os'

export class VersionStorage {
  private storagePath = ''
  private useFileStorage: boolean

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

    console.log('Getting versions for document:', documentId)
    const versionsPath = this.getVersionsPath(documentId)

    try {
      const files = await fs.readdir(versionsPath)
      console.log('Found version files:', files)
      
      const versions = await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(async (file) => {
            const content = await fs.readFile(path.join(versionsPath, file), 'utf-8')
            return JSON.parse(content) as VersionData
          })
      )
      return versions.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('Error reading versions:', error)
      return []
    }
  }

  async createVersion(version: Omit<VersionData, 'id'>): Promise<VersionData> {
    if (!this.useFileStorage) {
      throw new Error('File storage is not enabled - use MongoDB adapter for version management')
    }

    console.log('Creating version for document:', version.documentId)
    const versionsPath = this.getVersionsPath(version.documentId)

    const newVersion: VersionData = {
      ...version,
      id: this.generateId()
    }

    const filePath = path.join(versionsPath, `${newVersion.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(newVersion, null, 2))
    console.log('Version created:', newVersion.id)

    return newVersion
  }

  async getVersion(documentId: string, versionId: string): Promise<VersionData | null> {
    if (!this.useFileStorage) {
      return null // In mongo mode, versions should be handled by mongo adapter
    }

    const filePath = path.join(this.getVersionsPath(documentId), `${versionId}.json`)
    
    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content) as VersionData
    } catch (error) {
      console.error('Error reading version:', error)
      return null
    }
  }

  async deleteVersion(documentId: string, versionId: string): Promise<boolean> {
    if (!this.useFileStorage) {
      return false // In mongo mode, versions should be handled by mongo adapter
    }

    console.log('Deleting version:', { documentId, versionId })
    const filePath = path.join(this.getVersionsPath(documentId), `${versionId}.json`)
    
    if (!fs.existsSync(filePath)) {
      console.log('Version file not found:', filePath)
      return false
    }

    try {
      await fs.unlink(filePath)
      console.log('Version deleted successfully')
      return true
    } catch (error) {
      console.error('Error deleting version:', error)
      return false
    }
  }

  generateId() {
    return uuidv4()
  }
} 