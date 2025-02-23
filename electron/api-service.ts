import { DocumentData, VersionData } from '@typez/globals'
import axios, { AxiosRequestConfig } from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import authService from './auth-service'
import { documentStorage, folderStorage, versionStorage } from './storage-adapter'
import { DEFAULT_DOCUMENT_CONTENT } from '../lib/constants'

// Read env config based on environment
const envPath = process.env.NODE_ENV === 'test' 
  ? path.join(process.cwd(), 'env-electron.test.json')
  : path.resolve(__dirname, '../../env-electron.json')

console.log('\n=== API Service Environment ===')
console.log('Environment:', process.env.NODE_ENV)
console.log('Config path:', envPath)

const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const useLocalDb = env.LOCAL_DB || false

const BASE_URL = process.env.NODE_ENV === 'test'
  ? 'http://localhost:3000/api'
  : 'https://www.whetstone-writer.com/api'

const DOCUMENTS_COLLECTION = 'documents'
const FOLDERS_COLLECTION = 'folders'

const apiService = {
  getDocuments: async () => {
    const result = await makeRequest('get', '/documents')
    return result.data
  },

  getFolders: async () => {
    const result = await makeRequest('get', '/folders')
    return result.data
  },

  deleteDocument: async (id: string) => {
    const result = await makeRequest('delete', `/documents/${id}`)
    return result.data
  },

  updateDocument: async (id: string, data: Partial<DocumentData>) => {
    const result = await makeRequest('patch', `/documents/${id}`, data)
    return result.data
  },

  post: async (url: string, body: any) => {
    const result = await makeRequest('post', url, body)
    return result.data
  },

  patch: async (url: string, body: any) => {
    const result = await makeRequest('patch', url, body)
    return result.data
  },

  get: async (url: string) => {
    const result = await makeRequest('get', url)
    return result.data
  },

  destroy: async (url: string) => {
    const result = await makeRequest('delete', url)
    return result.data
  }
}

const makeRequest = async (
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: Partial<DocumentData | VersionData>,
) => {
  console.log('\n=== API Request ===')
  console.log(`Method: ${method.toUpperCase()}`)
  console.log(`Endpoint: ${endpoint}`)
  console.log(`Local DB Mode: ${useLocalDb}`)

  if (useLocalDb) {
    // Clean the endpoint
    endpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
    console.log(`Cleaned endpoint: ${endpoint}`)

    // Handle collection-level operations
    if (endpoint === 'documents') {
      console.log('Handling collection-level documents request')
      if (method === 'get') {
        return { data: await documentStorage.find(DOCUMENTS_COLLECTION, {}) }
      }
      if (method === 'post') {
        console.log('Creating new document:', data)
        const now = Date.now()
        const newDocument = await documentStorage.create(DOCUMENTS_COLLECTION, {
          ...data,
          content: DEFAULT_DOCUMENT_CONTENT,
          comments: [],
          lastUpdated: now
        })
        console.log('Created document:', newDocument)
        return { data: newDocument }
      }
      return { data: null }
    }
    if (endpoint === 'folders') {
      console.log('Handling collection-level folders request')
      if (method === 'get') {
        return { data: await folderStorage.find(FOLDERS_COLLECTION, {}) }
      }
      if (method === 'post') {
        console.log('Creating new folder:', data)
        const now = Date.now()
        const newFolder = await folderStorage.create(FOLDERS_COLLECTION, {
          ...data,
          lastUpdated: now
        })
        console.log('Created folder:', newFolder)
        return { data: newFolder }
      }
      return { data: null }
    }

    // Handle bulk fetch operation
    if (endpoint === 'documents/bulk-fetch') {
      console.log('Handling bulk fetch request')
      if (method === 'post' && data) {
        const { ids } = data as { ids: string[] }
        console.log('Bulk fetching documents:', ids)
        const documents = await Promise.all(
          ids.map(id => documentStorage.findById(DOCUMENTS_COLLECTION, id))
        )
        return { data: documents.filter(Boolean) }
      }
      return { data: [] }
    }

    // Handle bulk delete operation
    if (endpoint === 'documents/bulk-delete') {
      console.log('Handling bulk delete request')
      if (method === 'post' && data) {
        const { documentIds = [], folderIds = [] } = data as { documentIds: string[], folderIds: string[] }
        console.log('Bulk deleting:', { documentIds, folderIds })

        // Helper function to recursively delete a folder and its contents
        async function deleteFolder(folderId: string) {
          console.log(`Starting to delete folder ${folderId}`)
          
          // Get all documents and subfolders in this folder
          const [docs, subfolders] = await Promise.all([
            documentStorage.find(DOCUMENTS_COLLECTION, { parentId: folderId }),
            documentStorage.find(FOLDERS_COLLECTION, { parentId: folderId })
          ])

          console.log(`Found in folder ${folderId}:`, {
            documentsCount: docs.length,
            subfoldersCount: subfolders.length,
            documents: docs.map(d => d._id),
            subfolders: subfolders.map(f => f._id)
          })

          // Recursively delete all subfolders
          if (subfolders.length > 0) {
            console.log(`Deleting ${subfolders.length} subfolders of ${folderId}`)
            await Promise.all(
              subfolders.map(folder => folder._id ? deleteFolder(folder._id) : Promise.resolve())
            )
          }

          // Delete all documents in this folder
          if (docs.length > 0) {
            console.log(`Deleting ${docs.length} documents from folder ${folderId}`)
            await Promise.all(
              docs.map(doc => doc._id ? 
                documentStorage.delete(DOCUMENTS_COLLECTION, { _id: doc._id }) : 
                Promise.resolve()
              )
            )
          }

          // Finally delete the folder itself
          console.log(`Deleting folder ${folderId}`)
          const result = await documentStorage.delete(FOLDERS_COLLECTION, { _id: folderId })
          if (!result) {
            throw new Error(`Failed to delete folder ${folderId}`)
          }
          return result
        }

        try {
          // Delete all documents
          if (documentIds.length > 0) {
            console.log(`Starting to delete ${documentIds.length} documents`)
            await Promise.all(
              documentIds.map(id => 
                documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id })
              )
            )
          }

          // Delete all folders recursively
          if (folderIds.length > 0) {
            console.log(`Starting to delete ${folderIds.length} folders`)
            await Promise.all(
              folderIds.map(id => deleteFolder(id))
            )
          }

          console.log('Bulk delete operation completed successfully')
          return { data: { success: true } }
        } catch (error: any) {
          console.error('Error during bulk delete:', error)
          return { data: { success: false, error: error.message || 'Unknown error occurred' } }
        }
      }
      return { data: null }
    }

    // Handle version operations - check this before document operations
    const versionMatch = endpoint.match(/^documents\/([^\/]+)\/versions(?:\?versionId=(.+))?$/)
    if (versionMatch) {
      const [, documentId, versionId] = versionMatch
      console.log('Version operation:', { documentId, versionId })

      switch (method) {
        case 'get':
          console.log('Getting versions for document:', documentId)
          return { data: await versionStorage.getVersions(documentId) }
        case 'post':
          if (!data) return { data: null }
          console.log('Creating version:', data)
          return { data: await versionStorage.createVersion(data as Omit<VersionData, 'id'>) }
        case 'delete':
          if (!versionId) {
            console.log('No version ID provided for deletion')
            return { data: { success: false, error: 'No version ID provided' } }
          }
          console.log('Deleting version:', { documentId, versionId })
          const success = await versionStorage.deleteVersion(documentId, versionId)
          return { data: { success } }
      }
    }

    // Handle document operations
    const documentMatch = endpoint.match(/^documents\/([^\/]+)$/)
    if (documentMatch) {
      const [, id] = documentMatch
      console.log('Document operation:', { id, collection: DOCUMENTS_COLLECTION })
      if (!id) {
        console.log('No document ID found in endpoint')
        return { data: null }
      }

      switch (method) {
        case 'get':
          console.log(`Finding document by ID: ${id} in collection: ${DOCUMENTS_COLLECTION}`)
          const doc = await documentStorage.findById(DOCUMENTS_COLLECTION, id)
          console.log('Document found:', doc ? 'yes' : 'no')
          return { data: doc }
        case 'patch':
          if (!data) return { data: null }
          return { data: await documentStorage.update(DOCUMENTS_COLLECTION, id, data as Partial<Document>) }
        case 'delete':
          console.log('Attempting to delete document with ID:', id)
          const deleteResult = await documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id })
          console.log('Delete operation result:', deleteResult)
          return { data: { success: deleteResult } }
        case 'post':
          if (!data) return { data: null }
          return { data: await documentStorage.create(DOCUMENTS_COLLECTION, data as Omit<Document, '_id'>) }
      }
    }

    // Handle folder operations
    const folderMatch = endpoint.match(/^folders\/([^\/]+)$/)
    if (folderMatch) {
      const [, id] = folderMatch
      console.log('Folder operation:', { id, collection: FOLDERS_COLLECTION })
      if (!id) {
        console.log('No folder ID found in endpoint')
        return { data: null }
      }

      switch (method) {
        case 'get':
          console.log(`Finding folder by ID: ${id} in collection: ${FOLDERS_COLLECTION}`)
          const folder = await folderStorage.findById(FOLDERS_COLLECTION, id)
          console.log('Folder found:', folder ? 'yes' : 'no')
          return { data: folder }
        case 'patch':
          if (!data) return { data: null }
          return { data: await folderStorage.update(FOLDERS_COLLECTION, id, data as Partial<Document>) }
        case 'delete':
          return { data: await folderStorage.delete(FOLDERS_COLLECTION, { _id: id }) }
        case 'post':
          if (!data) return { data: null }
          return { data: await folderStorage.create(FOLDERS_COLLECTION, data as Omit<Document, '_id'>) }
      }
    }

    // Handle version operations
    if (endpoint.startsWith('versions/')) {
      console.log('Version operation detected')
      const parts = endpoint.split('versions/')[1].split('/')
      console.log('Version parts:', parts)
      if (parts.length === 2) {
        const [docId, versionId] = parts
        switch (method) {
          case 'get':
            return { data: await versionStorage.getVersion(docId, versionId) }
          case 'delete':
            return { data: await versionStorage.deleteVersion(docId, versionId) }
        }
      } else if (parts.length === 1) {
        switch (method) {
          case 'get':
            return { data: await versionStorage.getVersions(parts[0]) }
          case 'post':
            if (!data) return { data: null }
            return { data: await versionStorage.createVersion(data as VersionData) }
        }
      }
    }

    console.log('No matching local operation found')
    return { data: null }
  }

  // Remote request
  endpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const url = `${BASE_URL}${endpoint}`
  
  // Get fresh access token
  let token = authService.getAccessToken()
  
  // If we have a token and it's expired, try to refresh
  if (token && authService.isTokenExpired(token)) {
    console.log('Token expired, attempting to refresh...')
    try {
      await authService.refreshTokens()
      token = authService.getAccessToken() // Get fresh token after refresh
      console.log('Token refreshed successfully')
    } catch (error) {
      console.error('Failed to refresh token:', error)
      throw new Error('Authentication expired. Please log in again.')
    }
  }

  if (!token) {
    console.error('No access token available')
    throw new Error('No authentication token available. Please log in.')
  }

  const config: AxiosRequestConfig = {
    headers: {
      'x-whetstone-authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  }

  console.log('Making request to URL:', url)
  console.log('Request config:', {
    method,
    url,
    headers: config.headers,
    data: method === 'post' || method === 'patch' ? data : undefined
  })

  try {
    if (method === 'patch' || method === 'post') {
      return axios[method](url, data, config)
    }
    return axios[method](url, config)
  } catch (error: any) {
    console.error('API request failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.response?.headers,
    })
    throw error
  }
}

export default apiService
