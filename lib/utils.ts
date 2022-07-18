import axios from 'axios'

const API = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}/`,
  responseType: 'json'
})

export default API