import { ApiResponse } from '@components/providers'
import axios from 'axios'
import env from './env'

const API = axios.create({
  baseURL: `${env.BASE_URL}/api`,
  responseType: 'json',
})

export async function get(url: string): ApiResponse {
  const result = await API.get(url)
  return result.data
}

export async function post(url: string, body: any): ApiResponse {
  const result = await API.post(url, body)
  return result.data
}

export async function update(url: string, body: any): ApiResponse<void> {
  const result = await API.patch(url, body)
  return result.data
}

export async function destroy(url: string): ApiResponse {
  const result = await API.delete(url)
  return result.data
}

export async function deleteMethod(url: string): ApiResponse {
  const result = await API.delete(url)
  return result.data
}

export default API
