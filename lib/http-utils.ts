import { ApiResponse } from '@components/providers'
import axios from 'axios'
import env from './env'

const API = axios.create({
  baseURL: `${env.BASE_URL}/`,
  responseType: 'json',
})

export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const { error: errorMessage } = await res.json()
    throw new Error(errorMessage)
  }
  return res.json()
}

export async function updateDoc(url: string, { arg }: { arg: any }) {
  await API.patch(url, arg)
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
  return await API.delete(url)
}

export default API
