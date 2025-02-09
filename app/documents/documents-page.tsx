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
    async (itemId: string, targetFolderId?: string, newFolderIndex?: number) => {
      console.log('=== moveItem called ===')
      console.log('Moving item:', {
        itemId,
        targetFolderId,
        newFolderIndex
      })

      // Helper function to reindex items in a folder
      const reindexItemsInFolder = async (folderId: string | undefined, movedItemId?: string, targetIndex?: number) => {
        console.log('\n=== reindexItemsInFolder ===')
        console.log('Reindexing folder:', {
          folderId,
          movedItemId,
          targetIndex
        })
        
        // Get all items in the folder and sort by current index
        let folderItems = [...docs.filter(d => d.parentId === folderId), ...folders.filter(f => f.parentId === folderId)]
          .sort((a, b) => (a.folderIndex || 0) - (b.folderIndex || 0))
        
        console.log('Current folder items before reorder:', folderItems.map(item => ({
          id: item._id,
          title: item.title,
          folderIndex: item.folderIndex,
          type: 'content' in item ? 'document' : 'folder'
        })))

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
            folderItems.splice(targetIndex, 0, movedItem)
            console.log('Inserted moved item at position:', targetIndex)
          }
        }
        
        console.log('Folder items after reorder:', folderItems.map(item => ({
          id: item._id,
          title: item.title,
          type: 'content' in item ? 'document' : 'folder',
          folderIndex: item.folderIndex
        })))
        
        // Reindex with simple incremental numbers
        const updates = folderItems.map((item, index) => ({
          id: item._id,
          isDocument: 'content' in item,
          folderIndex: index
        }))

        console.log('Planned updates:', updates)

        // Update all items in parallel
        await Promise.all(updates.map(async ({ id, isDocument, folderIndex }) => {
          try {
            const endpoint = isDocument ? 'documents' : 'folders'
            console.log(`Updating ${endpoint}/${id} with folderIndex:`, folderIndex)
            await API.patch(`${endpoint}/${id}`, {
              folderIndex,
              lastUpdated: Date.now()
            })
          } catch (e) {
            console.error(`Error updating index for ${id}:`, e)
          }
        }))

        return updates
      }

      // First check if it's a document
      const docIndex = docs.findIndex(d => d._id === itemId)
      if (docIndex !== -1) {
        console.log('\n=== Moving document ===')
        const oldParentId = docs[docIndex].parentId
        console.log('oldParentId:', oldParentId)
        
        try {
          console.log('Updating document position:', {
            id: itemId,
            newParent: targetFolderId || 'root',
            newIndex: newFolderIndex || 0
          })
          
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
            console.log('Reindexing old parent folder:', oldParentId)
            oldFolderUpdates = await reindexItemsInFolder(oldParentId)
          }
          console.log('Reindexing new parent folder:', targetFolderId)
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

          console.log('Final state update - docs:', updatedDocs.map(d => ({ id: d._id, parentId: d.parentId, index: d.folderIndex })))
          console.log('Final state update - folders:', updatedFolders.map(f => ({ id: f._id, parentId: f.parentId, index: f.folderIndex })))

          mutate(updatedDocs, false)
          setFolders(updatedFolders)
        } catch (e) {
          console.error('Error moving document:', e)
          mutate() // Revert on error
        }
        return
      }

      // If not a document, check if it's a folder
      const folderIndex = folders.findIndex(f => f._id === itemId)
      if (folderIndex !== -1) {
        console.log('\n=== Moving folder ===')
        const oldParentId = folders[folderIndex].parentId
        console.log('oldParentId:', oldParentId)
        
        try {
          console.log('Updating folder position:', {
            id: itemId,
            newParent: targetFolderId || 'root',
            newIndex: newFolderIndex || 0
          })
          
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
            console.log('Reindexing old parent folder:', oldParentId)
            oldFolderUpdates = await reindexItemsInFolder(oldParentId)
          }
          console.log('Reindexing new parent folder:', targetFolderId)
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

          console.log('Final state update - docs:', updatedDocs.map(d => ({ id: d._id, parentId: d.parentId, index: d.folderIndex })))
          console.log('Final state update - folders:', updatedFolders.map(f => ({ id: f._id, parentId: f.parentId, index: f.folderIndex })))

          mutate(updatedDocs, false)
          setFolders(updatedFolders)
        } catch (e) {
          console.error('Error moving folder:', e)
          setFolders(folders) // Revert on error
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

  const bulkDelete = useCallback(
    async (documentIds: string[], folderIds: string[]) => {
      try {
        // Optimistically update UI
        const updatedDocs = docs.filter(doc => !documentIds.includes(doc._id))
        const updatedFolders = folders.filter(folder => !folderIds.includes(folder._id))
        
        mutate(updatedDocs, false)
        setFolders(updatedFolders)

        // Make API call
        await API.post('documents/bulk-delete', {
          documentIds,
          folderIds
        })
      } catch (error) {
        console.error('Error in bulk delete:', error)
        // Revert on error
        mutate()
        const response = await API.get('folders')
        setFolders(response.data)
      }
    },
    [docs, folders, mutate]
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
      bulkDelete={bulkDelete}
    />
  )
}

export default withPageAuthRequired(NextDocumentsPage)
