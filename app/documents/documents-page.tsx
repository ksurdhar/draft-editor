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
    async (itemId: string, targetFolderId?: string, targetIndex?: number) => {
      console.log('Starting move operation:', {
        itemId,
        targetFolderId,
        targetIndex
      })

      // Get all items in the target folder
      const folderItems = [
        ...docs.filter(d => {
          // For root level, include items with undefined or 'root' parentId
          if (!targetFolderId) return !d.parentId || d.parentId === 'root'
          return d.parentId === targetFolderId
        }),
        ...folders.filter(f => {
          // For root level, include items with undefined or 'root' parentId
          if (!targetFolderId) return !f.parentId || f.parentId === 'root'
          return f.parentId === targetFolderId
        })
      ].sort((a, b) => (a.folderIndex || 0) - (b.folderIndex || 0))

      console.log('Current items in target folder:', {
        targetFolderId,
        items: folderItems.map(item => ({
          id: item._id,
          title: item.title,
          index: item.folderIndex
        }))
      })

      // Remove the moved item from the list if it's already in this folder
      const filteredItems = folderItems.filter(item => item._id !== itemId)
      
      // Get the moved item
      const movedDoc = docs.find(d => d._id === itemId)
      const movedFolder = folders.find(f => f._id === itemId)
      const movedItem = movedDoc || movedFolder
      
      if (!movedItem) {
        console.error('Could not find item to move:', itemId)
        return
      }

      console.log('Moving item details:', {
        itemId,
        title: movedItem.title,
        currentIndex: movedItem.folderIndex,
        currentParent: movedItem.parentId,
        targetIndex,
        targetParent: targetFolderId
      })

      // Insert the moved item at the target position
      filteredItems.splice(targetIndex || 0, 0, movedItem)
      
      // Create updates with sequential indices
      const updates = filteredItems.map((item, index) => ({
        id: item._id,
        isDocument: 'content' in item,
        folderIndex: index
      }))

      console.log('Calculated updates:', {
        updates: updates.map(u => ({
          id: u.id,
          newIndex: u.folderIndex,
          type: u.isDocument ? 'document' : 'folder'
        }))
      })

      try {
        // First update the moved item's parent and position
        const endpoint = movedDoc ? 'documents' : 'folders'
        console.log('Updating moved item:', {
          itemId,
          endpoint,
          newParent: targetFolderId || 'root',
          newIndex: targetIndex || 0
        })

        await API.patch(`${endpoint}/${itemId}`, {
          parentId: targetFolderId || 'root',
          folderIndex: targetIndex || 0,
          lastUpdated: Date.now()
        })

        // Then update all other items' positions
        console.log('Updating other items positions...')
        await Promise.all(updates.map(async ({ id, isDocument, folderIndex }) => {
          if (id === itemId) return // Skip the moved item as we already updated it
          const endpoint = isDocument ? 'documents' : 'folders'
          console.log('Updating item:', {
            id,
            type: isDocument ? 'document' : 'folder',
            newIndex: folderIndex
          })
          await API.patch(`${endpoint}/${id}`, {
            folderIndex,
            lastUpdated: Date.now()
          })
        }))

        // Update local state
        const updatedDocs = docs.map(doc => {
          const update = updates.find(u => u.id === doc._id && u.isDocument)
          if (doc._id === itemId) {
            return { ...doc, parentId: targetFolderId || 'root', folderIndex: targetIndex || 0 }
          }
          return update ? { ...doc, folderIndex: update.folderIndex } : doc
        })

        const updatedFolders = folders.map(folder => {
          const update = updates.find(u => u.id === folder._id && !u.isDocument)
          if (folder._id === itemId) {
            return { ...folder, parentId: targetFolderId || 'root', folderIndex: targetIndex || 0 }
          }
          return update ? { ...folder, folderIndex: update.folderIndex } : folder
        })

        console.log('Updating local state with new positions')
        mutateDocuments(updatedDocs, false)
        mutateFolders(updatedFolders, false)
        console.log('Move operation completed successfully')
      } catch (error) {
        console.error('Error during move operation:', error)
        // Revert on error
        mutateDocuments()
        mutateFolders()
      }
    },
    [docs, folders, mutateDocuments, mutateFolders]
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
      renameDocument={renameDocument}
      createFolder={createFolder}
      renameFolder={renameFolder}
      onMove={moveItem}
      isLoading={docsLoading || foldersLoading}
      bulkDelete={bulkDelete}
    />
  )
}

export default withPageAuthRequired(NextDocumentsPage)
