import BaseDocumentsPage from '@components/shared-documents-page'
import { DocumentData, FolderData } from '@typez/globals'
import { useUser } from '@wrappers/next-auth0-client'
import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'wouter'

const ElectronDocumentsPage = () => {
  const [_, setLocation] = useLocation()
  const [docs, setDocs] = useState<DocumentData[]>([])
  const [folders, setFolders] = useState<FolderData[]>([])
  const { isLoading } = useUser()

  useEffect(() => {
    const fetchData = async () => {
      const [docsResult, foldersResult] = await Promise.all([
        window.electronAPI.getDocuments(),
        window.electronAPI.get('/folders')
      ])
      setDocs(docsResult)
      setFolders(foldersResult)
    }
    fetchData()
  }, [])

  const deleteDocument = useCallback(
    async (id: string) => {
      const prevDocs = docs
      const updatedDocs = docs.filter(doc => doc.id !== id)
      setDocs(updatedDocs)
      try {
        await window.electronAPI.deleteDocument(id)
      } catch (e) {
        console.log(e)
        setDocs(prevDocs)
      }
    },
    [docs],
  )

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      const prevDocs = docs
      const updatedDocs = docs.map(doc => (doc.id === id ? { ...doc, title } : doc))
      setDocs(updatedDocs)

      try {
        await window.electronAPI.renameDocument(id, { title, lastUpdated: Date.now() })
      } catch (e) {
        console.log(e)
        setDocs(prevDocs)
      }
    },
    [docs],
  )

  const createFolder = useCallback(
    async (title: string, parentId?: string) => {
      try {
        const response = await window.electronAPI.post('folders', {
          title,
          parentId,
          userId: 'current',
          lastUpdated: Date.now()
        })
        setFolders([...folders, response])
      } catch (error) {
        console.error('Error creating folder:', error)
      }
    },
    [folders]
  )

  const renameFolder = useCallback(
    async (id: string, title: string) => {
      try {
        const response = await window.electronAPI.patch(`folders/${id}`, {
          title,
          lastUpdated: Date.now()
        })
        setFolders(folders.map(folder => folder._id === id ? response : folder))
      } catch (error) {
        console.error('Error renaming folder:', error)
      }
    },
    [folders]
  )

  const moveItem = useCallback(
    async (itemId: string, targetFolderId?: string, targetIndex?: number) => {
      console.log('Moving item:', { itemId, targetFolderId, targetIndex })
      
      // Get all items in the target folder
      const folderItems = [
        ...docs.filter(d => {
          if (!targetFolderId) return !d.parentId || d.parentId === 'root'
          return d.parentId === targetFolderId
        }),
        ...folders.filter(f => {
          if (!targetFolderId) return !f.parentId || f.parentId === 'root'
          return f.parentId === targetFolderId
        })
      ].sort((a, b) => (a.folderIndex || 0) - (b.folderIndex || 0))

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

      // Insert the moved item at the target position
      filteredItems.splice(targetIndex || 0, 0, movedItem)
      
      // Create updates with sequential indices
      const updates = filteredItems.map((item, index) => ({
        id: item._id,
        isDocument: 'content' in item,
        folderIndex: index
      }))

      try {
        // Update the moved item's parent and position
        const endpoint = movedDoc ? 'documents' : 'folders'
        await window.electronAPI.patch(`${endpoint}/${itemId}`, {
          parentId: targetFolderId || 'root',
          folderIndex: targetIndex || 0,
          lastUpdated: Date.now()
        })

        // Update all other items' positions
        await Promise.all(updates.map(async ({ id, isDocument, folderIndex }) => {
          if (id === itemId) return // Skip the moved item as we already updated it
          const endpoint = isDocument ? 'documents' : 'folders'
          await window.electronAPI.patch(`${endpoint}/${id}`, {
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

        setDocs(updatedDocs)
        setFolders(updatedFolders)
      } catch (error) {
        console.error('Error during move operation:', error)
      }
    },
    [docs, folders]
  )

  const bulkDelete = useCallback(
    async (documentIds: string[], folderIds: string[]) => {
      try {
        // Optimistically update UI
        const updatedDocs = docs.filter(doc => !documentIds.includes(doc._id))
        const updatedFolders = folders.filter(folder => !folderIds.includes(folder._id))
        
        setDocs(updatedDocs)
        setFolders(updatedFolders)

        // Make API calls
        await window.electronAPI.post('documents/bulk-delete', {
          documentIds,
          folderIds
        })
      } catch (error) {
        console.error('Error in bulk delete:', error)
        // Revert on error
        const fetchData = async () => {
          const [docsResult, foldersResult] = await Promise.all([
            window.electronAPI.getDocuments(),
            window.electronAPI.get('/folders')
          ])
          setDocs(docsResult)
          setFolders(foldersResult)
        }
        fetchData()
      }
    },
    [docs, folders]
  )

  const navigateTo = useCallback(
    (path: string) => {
      setLocation(path)
    },
    [setLocation],
  )

  return (
    <BaseDocumentsPage
      docs={docs}
      folders={folders}
      renameDocument={renameDocument}
      createFolder={createFolder}
      renameFolder={renameFolder}
      onMove={moveItem}
      isLoading={isLoading}
      bulkDelete={bulkDelete}
    />
  )
}

export default ElectronDocumentsPage
