'use client'
import SharedDocumentsPage from '@components/shared-documents-page'
import { useDocSync, useFolderSync } from '@lib/hooks'
import API from '@lib/http-utils'
import { withPageAuthRequired, useUser } from '@wrappers/auth-wrapper-client'
import { useCallback, useMemo } from 'react'
import { useSWRConfig } from 'swr'
import { moveItem, bulkDelete, createDocument, DocumentOperations } from '@lib/document-operations'
import { useNavigation } from '@components/providers'

export const NextDocumentsPage = () => {
  const { docs, mutate: mutateDocuments, isLoading: docsLoading } = useDocSync()
  const { folders, mutate: mutateFolders, isLoading: foldersLoading } = useFolderSync()
  const { cache } = useSWRConfig()
  const { navigateTo } = useNavigation()
  const { user } = useUser()

  const operations = useMemo<DocumentOperations>(() => ({
    patchDocument: (id: string, data: any) => API.patch(`documents/${id}`, data),
    patchFolder: (id: string, data: any) => API.put(`folders/${id}`, data),
    bulkDeleteItems: (documentIds: string[], folderIds: string[]) => 
      API.post('documents/bulk-delete', { documentIds, folderIds }),
    createDocument: async (data: any) => {
      const response = await API.post('/documents', data)
      return response.data
    }
  }), [])

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
            mutateDocuments(updatedDocs, false)
            mutateFolders(updatedFolders, false)
          }
        )
      } catch (error) {
        // Revert on error
        mutateDocuments()
        mutateFolders()
      }
    },
    [docs, folders, operations, mutateDocuments, mutateFolders]
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
            mutateDocuments(updatedDocs, false)
            mutateFolders(updatedFolders, false)
          }
        )
      } catch (error) {
        // Revert on error
        mutateDocuments()
        mutateFolders()
      }
    },
    [docs, folders, operations, mutateDocuments, mutateFolders]
  )

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      const updatedDocs = docs.map(doc => (doc._id === id ? { ...doc, title } : doc))
      mutateDocuments(updatedDocs, false)
      try {
        await operations.patchDocument(id, {
          title,
          lastUpdated: Date.now(),
        })
      } catch (e) {
        console.log(e)
        mutateDocuments()
      }

      cache.delete(`documents/${id}`)
    },
    [mutateDocuments, docs, cache, operations],
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
        const response = await operations.patchFolder(id, {
          title,
          lastUpdated: Date.now()
        })
        mutateFolders(folders.map(folder => folder._id === id ? response.data : folder), false)
      } catch (error) {
        console.error('Error renaming folder:', error)
        mutateFolders()
      }
    },
    [folders, mutateFolders, operations]
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
  }, [user?.sub, operations, navigateTo])

  return (
    <SharedDocumentsPage
      docs={docs}
      folders={folders}
      renameDocument={renameDocument}
      createFolder={createFolder}
      renameFolder={renameFolder}
      onMove={handleMoveItem}
      isLoading={docsLoading || foldersLoading}
      bulkDelete={handleBulkDelete}
      onCreateDocument={handleCreateDocument}
    />
  )
}

export default withPageAuthRequired(NextDocumentsPage)
