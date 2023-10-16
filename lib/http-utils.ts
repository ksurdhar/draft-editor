import axios from 'axios'

const API = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}/`,
  responseType: 'json'
})

export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const { error: errorMessage } = await res.json()
    throw new Error(errorMessage)
  }
  return res.json()
}

export async function updateDoc(url: string, { arg }: { arg: any}) {
  await API.patch(url, arg)
}

export default API