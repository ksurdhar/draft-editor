import axios from 'axios'

// Configured to speak to localhost. 
// Update when express server is deployed
const API = axios.create({
  baseURL: 'http://localhost:3000/',
  responseType: 'json'
})

export default API