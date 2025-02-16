import BaseDocumentsPage from '@components/shared-documents-page'
import { DocumentData, FolderData } from '@typez/globals'
import { useUser } from '@wrappers/next-auth0-client'
import { useCallback, useEffect, useState, useMemo } from 'react'
import { useLocation } from 'wouter'
import { moveItem, bulkDelete, createDocument, DocumentOperations } from '@lib/document-operations'

const ElectronDocumentsPage = () => {
  const [_, setLocation] = useLocation()
  const [docs, setDocs] = useState<DocumentData[]>([])
  const [folders, setFolders] = useState<FolderData[]>([])
  const { isLoading, user } = useUser()

  const operations = useMemo<DocumentOperations>(() => ({
    patchDocument: (id: string, data: any) => window.electronAPI.renameDocument(id, data),
    patchFolder: (id: string, data: any) => window.electronAPI.patch(`folders/${id}`, data),
    bulkDeleteItems: (documentIds: string[], folderIds: string[]) => 
      window.electronAPI.post('documents/bulk-delete', { documentIds, folderIds }),
    createDocument: async (data: any) => {
      const response = await window.electronAPI.createDocument(data)
      return response
    }
  }), [])

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

  const handleMoveItem = useCallback(
    async (itemId: string, targetFolderId?: string, targetIndex?: number) => {
      try {
        await moveItem(
          itemId,
          targetFolderId,
          targetIndex,
          docs,
          folders,
          operations,
          (updatedDocs, updatedFolders) => {
            setDocs(updatedDocs)
            setFolders(updatedFolders)
          }
        )
      } catch (error) {
        // On error, refresh the data
        const [docsResult, foldersResult] = await Promise.all([
          window.electronAPI.getDocuments(),
          window.electronAPI.get('/folders')
        ])
        setDocs(docsResult)
        setFolders(foldersResult)
      }
    },
    [docs, folders, operations]
  )

  const handleBulkDelete = useCallback(
    async (documentIds: string[], folderIds: string[]) => {
      try {
        await bulkDelete(
          documentIds,
          folderIds,
          docs,
          folders,
          operations,
          (updatedDocs, updatedFolders) => {
            setDocs(updatedDocs)
            setFolders(updatedFolders)
          }
        )
      } catch (error) {
        // On error, refresh the data
        const [docsResult, foldersResult] = await Promise.all([
          window.electronAPI.getDocuments(),
          window.electronAPI.get('/folders')
        ])
        setDocs(docsResult)
        setFolders(foldersResult)
      }
    },
    [docs, folders, operations]
  )

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      // Immediate optimistic update
      const updatedDocs = docs.map(doc => (doc._id === id ? { ...doc, title } : doc))
      setDocs(updatedDocs)

      try {
        await operations.patchDocument(id, { 
          title, 
          lastUpdated: Date.now() 
        })
      } catch (e) {
        console.log(e)
        // On error, fetch fresh data
        const docsResult = await window.electronAPI.getDocuments()
        setDocs(docsResult)
      }
    },
    [docs, operations]
  )

  const createFolder = useCallback(
    async (title: string, parentId?: string) => {
      try {
        // Prepare the folder data
        const folderData = {
          title,
          parentId: parentId || 'root', // Set root as default if no parent
          userId: user?.sub || 'mock|12345', // Use actual user ID
          lastUpdated: Date.now(),
          folderIndex: folders.length // Set folder index based on current folders length
        }

        // Make the API call
        const response = await window.electronAPI.post('folders', folderData)
        
        // Optimistically update the UI
        setFolders(currentFolders => [...currentFolders, response])

        // Fetch fresh data to ensure everything is in sync
        const foldersResult = await window.electronAPI.get('/folders')
        setFolders(foldersResult)
      } catch (error) {
        console.error('Error creating folder:', error)
        // On error, refresh the data to ensure UI is in sync
        const foldersResult = await window.electronAPI.get('/folders')
        setFolders(foldersResult)
      }
    },
    [folders.length, user?.sub] // Add dependencies for folders length and user ID
  )

  const renameFolder = useCallback(
    async (id: string, title: string) => {
      try {
        const response = await operations.patchFolder(id, {
          title,
          lastUpdated: Date.now()
        })
        setFolders(folders.map(folder => folder._id === id ? response : folder))
      } catch (error) {
        console.error('Error renaming folder:', error)
      }
    },
    [folders, operations]
  )

  const handleCreateDocument = useCallback(async () => {
    if (!user?.sub) return
    
    try {
      await createDocument(
        user.sub,
        operations,
        (docId) => {
          navigateTo(`/documents/${docId}?focus=title`)
        }
      )
    } catch (error) {
      console.error('Error creating document:', error)
    }
  }, [user?.sub, operations])

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
      onMove={handleMoveItem}
      isLoading={isLoading}
      bulkDelete={handleBulkDelete}
      onCreateDocument={handleCreateDocument}
    />
  )
}

export default ElectronDocumentsPage
