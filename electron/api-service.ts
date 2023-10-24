import axios from 'axios'
import authService from './auth-service'

const apiService = {
  getDocuments: async () => {
    const result = await axios.get('https://whetstone-writer.com/api/documents', {
      headers: {
        'Authorization': `Bearer ${authService.getAccessToken()}`,
      },
    })
    return result.data
  }
}

export default apiService