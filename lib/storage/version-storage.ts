import fs from 'fs-extra'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { VersionData } from '@typez/globals'

export class VersionStorage {
  private storagePath: string

  constructor() {
    this.storagePath = process.env.JSON_STORAGE_PATH || './data'
    this.initialize()
  }

  private initialize() {
    const versionsPath = path.join(this.storagePath, 'versions')
    fs.ensureDirSync(versionsPath)
  }

  private getVersionsPath(documentId: string) {
    return path.join(this.storagePath, 'versions', documentId)
  }

  async getVersions(documentId: string): Promise<VersionData[]> {
    const versionsPath = this.getVersionsPath(documentId)
    if (!fs.existsSync(versionsPath)) {
      return []
    }

    try {
      const files = await fs.readdir(versionsPath)
      const versions = await Promise.all(
        files.map(async (file) => {
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
    const versionsPath = this.getVersionsPath(version.documentId)
    fs.ensureDirSync(versionsPath)

    const newVersion: VersionData = {
      ...version,
      id: uuidv4()
    }

    const filePath = path.join(versionsPath, `${newVersion.id}.json`)
    await fs.writeFile(filePath, JSON.stringify(newVersion, null, 2))

    return newVersion
  }

  async getVersion(documentId: string, versionId: string): Promise<VersionData | null> {
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
    const filePath = path.join(this.getVersionsPath(documentId), `${versionId}.json`)
    
    if (!fs.existsSync(filePath)) {
      return false
    }

    try {
      await fs.unlink(filePath)
      return true
    } catch (error) {
      console.error('Error deleting version:', error)
      return false
    }
  }
} 