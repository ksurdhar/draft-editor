import { DocumentData } from '@typez/globals'
import axios from 'axios'
import authService from './auth-service'

const apiService = {
  getDocuments: async () => {
    const result = await axios.get('https://whetstone-writer.com/api/documents', {
      headers: {
        Authorization: `Bearer ${authService.getAccessToken()}`,
      },
    })
    return result.data
  },
  deleteDocument: async (id: string) => {
    const result = await axios.delete(`https://whetstone-writer.com/api/documents/${id}`, {
      headers: {
        Authorization: `Bearer ${authService.getAccessToken()}`,
      },
    })
    return result.data
  },
  updateDocument: async (id: string, data: Partial<DocumentData>) => {
    const result = await axios.patch(`https://whetstone-writer.com/api/documents/${id}`, data, {
      headers: {
        Authorization: `Bearer ${authService.getAccessToken()}`,
      },
    })
    return result.data
  },
}

export default apiService
