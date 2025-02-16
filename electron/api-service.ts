import { DocumentData, VersionData } from '@typez/globals'
import axios, { AxiosRequestConfig } from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import authService from './auth-service'
import { documentStorage, versionStorage } from './storage-adapter'

const envPath = path.resolve(__dirname, '../../env-electron.json')
const env = JSON.parse(fs.readFileSync(envPath, 'utf-8'))
const useLocalDb = env.LOCAL_DB || false

const BASE_URL = 'https://whetstone-writer.com/api'
const DOCUMENTS_COLLECTION = 'documents'
const FOLDERS_COLLECTION = 'folders'

// console.log('API Service Configuration:', {
//   useLocalDb,
//   baseUrl: BASE_URL,
//   documentsCollection: DOCUMENTS_COLLECTION,
//   foldersCollection: FOLDERS_COLLECTION
// })

const apiService = {
  getDocuments: async () => {
    // console.log('getDocuments called')
    const result = await makeRequest('get', '/documents')
    return result.data
  },

  getFolders: async () => {
    // console.log('getFolders called')
    const result = await makeRequest('get', '/folders')
    return result.data
  },

  deleteDocument: async (id: string) => {
    // console.log('deleteDocument called:', id)
    const result = await makeRequest('delete', `/documents/${id}`)
    return result.data
  },

  updateDocument: async (id: string, data: Partial<DocumentData>) => {
    // console.log('updateDocument called:', id)
    const result = await makeRequest('patch', `/documents/${id}`, data)
    return result.data
  },

  post: async (url: string, body: any) => {
    // console.log('post called:', url)
    const result = await makeRequest('post', url, body)
    return result.data
  },

  patch: async (url: string, body: any) => {
    console.log('patch called:', url)
    const result = await makeRequest('patch', url, body)
    return result.data
  },

  get: async (url: string) => {
    console.log('\nGET request:', { url })
    const result = await makeRequest('get', url)
    return result.data
  },

  destroy: async (url: string) => {
    console.log('destroy called:', url)
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
        const defaultContent = JSON.stringify([{ type: 'default', children: [{ text: '', highlight: 'none' }] }])
        const now = Date.now()
        const newDocument = await documentStorage.create(DOCUMENTS_COLLECTION, {
          ...data,
          content: defaultContent,
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
      return { data: await documentStorage.find(FOLDERS_COLLECTION, {}) }
    }

    // Handle document operations
    if (endpoint.startsWith('documents/')) {
      const id = endpoint.split('documents/')[1]
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
          return { data: await documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id }) }
        case 'post':
          if (!data) return { data: null }
          return { data: await documentStorage.create(DOCUMENTS_COLLECTION, data as Omit<Document, '_id'>) }
      }
    }

    // Handle folder operations
    if (endpoint.startsWith('folders/')) {
      const id = endpoint.split('folders/')[1]
      console.log('Folder operation:', { id, collection: FOLDERS_COLLECTION })
      if (!id) {
        console.log('No folder ID found in endpoint')
        return { data: null }
      }

      switch (method) {
        case 'get':
          console.log(`Finding folder by ID: ${id} in collection: ${FOLDERS_COLLECTION}`)
          const folder = await documentStorage.findById(FOLDERS_COLLECTION, id)
          console.log('Folder found:', folder ? 'yes' : 'no')
          return { data: folder }
        case 'patch':
          if (!data) return { data: null }
          return { data: await documentStorage.update(FOLDERS_COLLECTION, id, data as Partial<Document>) }
        case 'delete':
          return { data: await documentStorage.delete(FOLDERS_COLLECTION, { _id: id }) }
        case 'post':
          if (!data) return { data: null }
          return { data: await documentStorage.create(FOLDERS_COLLECTION, data as Omit<Document, '_id'>) }
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
  const config: AxiosRequestConfig = {
    headers: {
      Authorization: `Bearer ${authService.getAccessToken()}`,
    },
  }

  if (method === 'patch' || method === 'post') {
    return axios[method](url, data, config)
  }
  return axios[method](url, config)
}

export default apiService
