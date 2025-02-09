import { useAPI } from '@components/providers'
import { Dispatch, SetStateAction, useCallback, useEffect, useState, createContext, useContext } from 'react'
import useSWR from 'swr'
import { DocumentData } from '../types/globals'
import { FolderData } from '@typez/globals'

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

export const useFolderSync = () => {
  const api = useAPI()
  const fetcher = useCallback(
    async (path: string) => {
      return await api.get(path)
    },
    [api],
  )

  const { data: folders = [], mutate, isLoading } = useSWR<FolderData[]>('folders', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 0 // Disable deduping to ensure we always fetch fresh data
  })

  return { folders, mutate, isLoading }
}

// Add folders context and hook
interface FoldersContextType {
  folders: FolderData[]
  mutateFolders: () => Promise<any>
}

export const FoldersContext = createContext<FoldersContextType | null>(null)

export const useFolders = () => {
  const context = useContext(FoldersContext)
  if (!context) {
    throw new Error('useFolders must be used within a FoldersProvider')
  }
  return context
}
