import { useAPI } from '@components/providers'
import { Dispatch, SetStateAction, useCallback, useEffect, useState, createContext, useContext } from 'react'
import useSWR from 'swr'
import { DocumentData } from '../types/globals'
import { FolderData } from '@typez/globals'
import { Socket, io } from 'socket.io-client'

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
    
    // Function to get the latest state
    const getLatestState = () => {
      if (typeof window === 'undefined') return databaseDoc
      const sessionDoc = sessionStorage.getItem(id)

      if (sessionDoc) {
        const parsedDoc = JSON.parse(sessionDoc)
        // Check if the session doc is newer than the database doc
        if (!databaseDoc || parsedDoc.lastUpdated > databaseDoc.lastUpdated) {
          return parsedDoc
        }
      }

      return databaseDoc
    }

    // Update the hybrid doc with the latest state
    const latestDoc = getLatestState()
    setHybridDoc(latestDoc)

    // Listen for storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === id) {
        const latestDoc = getLatestState()
        setHybridDoc(latestDoc)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      return () => window.removeEventListener('storage', handleStorageChange)
    }
  }, [id, databaseDoc, setHybridDoc])
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

// Document socket hook for future use
// socket?.emit('document-updated', data) <-- on debounced save do this
export const useDocumentSocket = (documentId: string) => {
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!documentId) return

    const socket = io('https://ws.whetstone-writer.com', { query: { documentId } })

    setSocket(socket)

    socket.on('message', (msg: any) => {
      console.log('Message from server:', msg)
    })

    socket.on('joined', (msg: any) => {
      console.log(msg)
    })

    socket.on('disconnect', (msg: any) => {
      console.log(msg)
    })

    socket.on('document-updated', (msg: any) => {
      console.log(msg)
    })

    return () => {
      socket.disconnect()
    }
  }, [documentId])

  return socket
}
