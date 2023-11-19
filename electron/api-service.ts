import { DocumentData } from '@typez/globals'
import axios, { AxiosRequestConfig } from 'axios'
import authService from './auth-service'

const BASE_URL = 'https://whetstone-writer.com/api'

const apiService = {
  getDocuments: async () => {
    const result = await makeRequest('get', '/documents')
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
  },
}

const makeRequest = async (
  method: 'get' | 'delete' | 'patch' | 'post',
  endpoint: string,
  data?: Partial<DocumentData>,
) => {
  const config: AxiosRequestConfig = {
    headers: {
      Authorization: `Bearer ${authService.getAccessToken()}`,
    },
  }

  if (method === 'patch' || method === 'post') {
    return axios[method](BASE_URL + endpoint, data, config)
  } else {
    return axios[method](BASE_URL + endpoint, config)
  }
}

export default apiService
