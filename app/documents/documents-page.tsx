'use client'
import SharedDocumentsPage from '@components/shared-documents-page'
import { useDocSync } from '@lib/hooks'
import API from '@lib/http-utils'
import { withPageAuthRequired } from '@wrappers/auth-wrapper-client'
import { useCallback, useState, useEffect } from 'react'
import { useSWRConfig } from 'swr'
import { FolderData } from '@typez/globals'

export const NextDocumentsPage = () => {
  const { docs, mutate, isLoading } = useDocSync()
  const { cache } = useSWRConfig()
  const [folders, setFolders] = useState<FolderData[]>([])

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const response = await API.get('folders')
        setFolders(response.data)
      } catch (error) {
        console.error('Error fetching folders:', error)
      }
    }
    fetchFolders()
  }, [])

  const moveItem = useCallback(
    async (itemId: string, targetFolderId?: string) => {
      // First check if it's a document
      const docIndex = docs.findIndex(d => d._id === itemId)
      if (docIndex !== -1) {
        const updatedDocs = docs.map(doc => 
          doc._id === itemId ? { ...doc, parentId: targetFolderId } : doc
        )
        mutate(updatedDocs, false)
        try {
          await API.patch(`documents/${itemId}`, {
            parentId: targetFolderId,
            lastUpdated: Date.now()
          })
        } catch (e) {
          console.error(e)
          mutate() // Revert on error
        }
        return
      }

      // If not a document, check if it's a folder
      const folderIndex = folders.findIndex(f => f._id === itemId)
      if (folderIndex !== -1) {
        const updatedFolders = folders.map(folder =>
          folder._id === itemId ? { ...folder, parentId: targetFolderId } : folder
        )
        setFolders(updatedFolders)
        try {
          await API.patch(`folders/${itemId}`, {
            parentId: targetFolderId,
            lastUpdated: Date.now()
          })
        } catch (e) {
          console.error(e)
          // Revert on error
          setFolders(folders)
        }
      }
    },
    [docs, folders, mutate]
  )

  const deleteDocument = useCallback(
    async (id: string) => {
      const updatedDocs = docs.filter(doc => doc._id !== id)
      mutate(updatedDocs, false)
      try {
        await API.delete(`documents/${id}`)
      } catch (e) {
        console.log(e)
        mutate()
      }
    },
    [mutate, docs],
  )

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      const updatedDocs = docs.map(doc => (doc._id === id ? { ...doc, title } : doc))
      mutate(updatedDocs, false)
      try {
        await API.patch(`documents/${id}`, {
          title,
          lastUpdated: Date.now(),
        })
      } catch (e) {
        console.log(e)
        mutate()
      }

      cache.delete(`documents/${id}`)
    },
    [mutate, docs, cache],
  )

  const createFolder = useCallback(
    async (title: string, parentId?: string) => {
      try {
        const response = await API.post('folders', {
          title,
          parentId,
          userId: 'current', // The server will use the authenticated user's ID
          lastUpdated: Date.now()
        })
        setFolders(prev => [...prev, response.data])
      } catch (error) {
        console.error('Error creating folder:', error)
      }
    },
    []
  )

  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        await API.delete(`folders/${id}`)
        setFolders(prev => prev.filter(folder => folder._id !== id))
      } catch (error) {
        console.error('Error deleting folder:', error)
      }
    },
    []
  )

  const renameFolder = useCallback(
    async (id: string, title: string) => {
      try {
        const response = await API.put(`folders/${id}`, {
          title,
          lastUpdated: Date.now()
        })
        setFolders(prev => prev.map(folder => folder._id === id ? response.data : folder))
      } catch (error) {
        console.error('Error renaming folder:', error)
      }
    },
    []
  )

  return (
    <SharedDocumentsPage
      docs={docs}
      folders={folders}
      deleteDocument={deleteDocument}
      renameDocument={renameDocument}
      createFolder={createFolder}
      deleteFolder={deleteFolder}
      renameFolder={renameFolder}
      onMove={moveItem}
      isLoading={isLoading}
    />
  )
}

export default withPageAuthRequired(NextDocumentsPage)
