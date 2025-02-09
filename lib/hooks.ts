import { useAPI } from '@components/providers'
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'
import { DocumentData } from '../types/globals'

export const useSpinner = (optionalCondition?: boolean) => {
  const [allowSpinner, setAllowSpinner] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      setAllowSpinner(true)
    }, 333)
    return () => clearTimeout(timer)
  }, [])

  return optionalCondition === undefined ? allowSpinner : allowSpinner && optionalCondition
}

export const useSyncHybridDoc = (
  id: string,
  databaseDoc: DocumentData | undefined,
  setHybridDoc: Dispatch<SetStateAction<DocumentData | null | undefined>>,
) => {
  useEffect(() => {
    let cachedDoc: DocumentData | {} = {}
    if (typeof window !== 'undefined') {
      cachedDoc = JSON.parse(sessionStorage.getItem(id) || '{}')
    }
    const documentNotCached = Object.keys(cachedDoc).length === 0

    if (documentNotCached) {
      // console.log('document not cached, applying DB doc')
      setHybridDoc(databaseDoc)
    } else {
      // console.log('document cached, using session storage doc')
      setHybridDoc(cachedDoc as DocumentData)
    }
  }, [databaseDoc, setHybridDoc, id])
}

export const useDocSync = () => {
  const api = useAPI()
  const fetcher = useCallback(
    async (path: string) => {
      return await api.get(path)
    },
    [api],
  )

  const { data: docs = [], mutate, isLoading } = useSWR<DocumentData[]>('/documents', fetcher)

  useEffect(() => {
    // Only store in sessionStorage if we're not using JSON storage
    if (process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'json') {
      console.log('Storing docs in sessionStorage', process.env.NEXT_PUBLIC_STORAGE_TYPE)
      docs?.forEach(doc => {
        sessionStorage.setItem(doc._id, JSON.stringify(doc))
      })
    }
  }, [docs])
  return { docs, mutate, isLoading }
}
