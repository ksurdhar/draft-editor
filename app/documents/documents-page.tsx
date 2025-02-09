'use client'
import SharedDocumentsPage from '@components/shared-documents-page'
import { useDocSync, useFolderSync } from '@lib/hooks'
import API from '@lib/http-utils'
import { withPageAuthRequired } from '@wrappers/auth-wrapper-client'
import { useCallback } from 'react'
import { useSWRConfig } from 'swr'

export const NextDocumentsPage = () => {
  const { docs, mutate: mutateDocuments, isLoading: docsLoading } = useDocSync()
  const { folders, mutate: mutateFolders, isLoading: foldersLoading } = useFolderSync()
  const { cache } = useSWRConfig()

  const moveItem = useCallback(
    async (itemId: string, targetFolderId?: string, newFolderIndex?: number) => {
      // Helper function to reindex items in a folder
      const reindexItemsInFolder = async (folderId: string | undefined, movedItemId?: string, targetIndex?: number) => {
        // Get all items in the folder and sort by current index
        let folderItems = [...docs.filter(d => d.parentId === folderId), ...folders.filter(f => f.parentId === folderId)]
          .sort((a, b) => (a.folderIndex || 0) - (b.folderIndex || 0))

        // If we're moving an item to a specific position
        if (movedItemId && typeof targetIndex === 'number') {
          // First remove the moved item if it's already in this folder
          folderItems = folderItems.filter(item => item._id !== movedItemId)
          
          // Get the moved item from either docs or folders
          const movedDoc = docs.find(d => d._id === movedItemId)
          const movedFolder = folders.find(f => f._id === movedItemId)
          const movedItem = movedDoc || movedFolder
          
          if (movedItem) {
            // Insert at the target position
            folderItems.splice(targetIndex, 0, { ...movedItem, folderIndex: targetIndex })
          }
        }
        
        // Reindex with sequential numbers, but preserve the moved item's index
        const updates = folderItems.map((item, index) => {
          // If this is the moved item, keep its exact index
          if (item._id === movedItemId) {
            return {
              id: item._id,
              isDocument: 'content' in item,
              folderIndex: targetIndex
            }
          }
          // Otherwise use sequential numbers, skipping the target index
          const newIndex = index >= targetIndex ? index + 1 : index
          return {
            id: item._id,
            isDocument: 'content' in item,
            folderIndex: newIndex
          }
        })

        // Update all items in parallel
        await Promise.all(updates.map(async ({ id, isDocument, folderIndex }) => {
          try {
            const endpoint = isDocument ? 'documents' : 'folders'
            await API.patch(`${endpoint}/${id}`, {
              folderIndex,
              lastUpdated: Date.now()
            })
          } catch (e) {
            // Handle error silently
          }
        }))

        return updates
      }

      // First check if it's a document
      const docIndex = docs.findIndex(d => d._id === itemId)
      if (docIndex !== -1) {
        const oldParentId = docs[docIndex].parentId
        
        try {
          // First update the moved item
          await API.patch(`documents/${itemId}`, {
            parentId: targetFolderId || 'root',
            folderIndex: newFolderIndex || 0,
            lastUpdated: Date.now()
          })
          
          let oldFolderUpdates: any[] = []
          let newFolderUpdates: any[] = []

          // Reindex items in both old and new folders
          if (oldParentId !== targetFolderId) {
            oldFolderUpdates = await reindexItemsInFolder(oldParentId)
          }
          newFolderUpdates = await reindexItemsInFolder(targetFolderId, itemId, newFolderIndex)

          // Combine all updates and apply to local state
          const allUpdates = [...oldFolderUpdates, ...newFolderUpdates]
          const updatedDocs = docs.map(doc => {
            const update = allUpdates.find(u => u.id === doc._id && u.isDocument)
            if (doc._id === itemId) {
              return { ...doc, parentId: targetFolderId || 'root', folderIndex: newFolderIndex || 0 }
            }
            return update ? { ...doc, folderIndex: update.folderIndex } : doc
          })

          const updatedFolders = folders.map(folder => {
            const update = allUpdates.find(u => u.id === folder._id && !u.isDocument)
            return update ? { ...folder, folderIndex: update.folderIndex } : folder
          })

          mutateDocuments(updatedDocs, false)
          mutateFolders(updatedFolders, false)
        } catch (e) {
          // Handle error silently
          mutateDocuments() // Revert on error
          mutateFolders() // Revert on error
        }
        return
      }

      // If not a document, check if it's a folder
      const folderIndex = folders.findIndex(f => f._id === itemId)
      if (folderIndex !== -1) {
        const oldParentId = folders[folderIndex].parentId
        
        try {
          // First update the moved item
          await API.patch(`folders/${itemId}`, {
            parentId: targetFolderId || 'root',
            folderIndex: newFolderIndex || 0,
            lastUpdated: Date.now()
          })

          let oldFolderUpdates: any[] = []
          let newFolderUpdates: any[] = []

          // Reindex items in both old and new folders
          if (oldParentId !== targetFolderId) {
            oldFolderUpdates = await reindexItemsInFolder(oldParentId)
          }
          newFolderUpdates = await reindexItemsInFolder(targetFolderId, itemId, newFolderIndex)

          // Combine all updates and apply to local state
          const allUpdates = [...oldFolderUpdates, ...newFolderUpdates]
          const updatedDocs = docs.map(doc => {
            const update = allUpdates.find(u => u.id === doc._id && u.isDocument)
            return update ? { ...doc, folderIndex: update.folderIndex } : doc
          })

          const updatedFolders = folders.map(folder => {
            const update = allUpdates.find(u => u.id === folder._id && !u.isDocument)
            if (folder._id === itemId) {
              return { ...folder, parentId: targetFolderId || 'root', folderIndex: newFolderIndex || 0 }
            }
            return update ? { ...folder, folderIndex: update.folderIndex } : folder
          })

          mutateDocuments(updatedDocs, false)
          mutateFolders(updatedFolders, false)
        } catch (e) {
          // Handle error silently
          mutateFolders() // Revert on error
        }
      }
    },
    [docs, folders, mutateDocuments, mutateFolders]
  )

  const deleteDocument = useCallback(
    async (id: string) => {
      const updatedDocs = docs.filter(doc => doc._id !== id)
      mutateDocuments(updatedDocs, false)
      try {
        await API.delete(`documents/${id}`)
      } catch (e) {
        console.log(e)
        mutateDocuments()
      }
    },
    [mutateDocuments, docs],
  )

  const bulkDelete = useCallback(
    async (documentIds: string[], folderIds: string[]) => {
      try {
        // Optimistically update UI
        const updatedDocs = docs.filter(doc => !documentIds.includes(doc._id))
        const updatedFolders = folders.filter(folder => !folderIds.includes(folder._id))
        
        mutateDocuments(updatedDocs, false)
        mutateFolders(updatedFolders, false)

        // Make API call
        await API.post('documents/bulk-delete', {
          documentIds,
          folderIds
        })
      } catch (error) {
        console.error('Error in bulk delete:', error)
        // Revert on error
        mutateDocuments()
        mutateFolders()
      }
    },
    [docs, folders, mutateDocuments, mutateFolders]
  )

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      const updatedDocs = docs.map(doc => (doc._id === id ? { ...doc, title } : doc))
      mutateDocuments(updatedDocs, false)
      try {
        await API.patch(`documents/${id}`, {
          title,
          lastUpdated: Date.now(),
        })
      } catch (e) {
        console.log(e)
        mutateDocuments()
      }

      cache.delete(`documents/${id}`)
    },
    [mutateDocuments, docs, cache],
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
        mutateFolders([...folders, response.data], false)
      } catch (error) {
        console.error('Error creating folder:', error)
        mutateFolders()
      }
    },
    [folders, mutateFolders]
  )

  const deleteFolder = useCallback(
    async (id: string) => {
      try {
        await API.delete(`folders/${id}`)
        mutateFolders(folders.filter(folder => folder._id !== id), false)
      } catch (error) {
        console.error('Error deleting folder:', error)
        mutateFolders()
      }
    },
    [folders, mutateFolders]
  )

  const renameFolder = useCallback(
    async (id: string, title: string) => {
      try {
        const response = await API.put(`folders/${id}`, {
          title,
          lastUpdated: Date.now()
        })
        mutateFolders(folders.map(folder => folder._id === id ? response.data : folder), false)
      } catch (error) {
        console.error('Error renaming folder:', error)
        mutateFolders()
      }
    },
    [folders, mutateFolders]
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
      isLoading={docsLoading || foldersLoading}
      bulkDelete={bulkDelete}
    />
  )
}

export default withPageAuthRequired(NextDocumentsPage)
