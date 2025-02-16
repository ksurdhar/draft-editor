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
      const docId = await createDocument(
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
