import SharedDocumentsPage from '@components/shared-documents-page'
import { DocumentData, FolderData } from '@typez/globals'
import { useEffect } from 'react'
import useSWR from 'swr'

interface SyncUpdates {
  documents?: DocumentData[]
  folders?: FolderData[]
}

const ElectronDocumentsPage = () => {
  const {
    data: documents,
    mutate: mutateDocuments,
    isLoading: docsLoading,
  } = useSWR<DocumentData[]>('/documents', window.electronAPI.get, {
    revalidateOnFocus: false,
    focusThrottleInterval: 30000,
    dedupingInterval: 10000,
    revalidateIfStale: false,
  })

  const {
    data: folders,
    mutate: mutateFolders,
    isLoading: foldersLoading,
  } = useSWR<FolderData[]>('/folders', window.electronAPI.get, {
    revalidateOnFocus: false,
    focusThrottleInterval: 30000,
    dedupingInterval: 10000,
    revalidateIfStale: false,
  })

  // Listen for sync updates from main process
  useEffect(() => {
    const removeListener = window.electronAPI.onSyncUpdate((updates: SyncUpdates) => {
      if (updates.documents && updates.documents.length > 0) {
        // Merge new documents with existing ones, replacing any that have the same ID
        mutateDocuments(currentDocs => {
          const currentDocsMap = new Map(currentDocs?.map(doc => [doc._id, doc]) || [])
          updates.documents!.forEach(doc => currentDocsMap.set(doc._id, doc))
          return Array.from(currentDocsMap.values())
        }, false)
      }
      if (updates.folders && updates.folders.length > 0) {
        // Merge new folders with existing ones, replacing any that have the same ID
        mutateFolders(currentFolders => {
          const currentFoldersMap = new Map(currentFolders?.map(folder => [folder._id, folder]) || [])
          updates.folders!.forEach(folder => currentFoldersMap.set(folder._id, folder))
          return Array.from(currentFoldersMap.values())
        }, false)
      }
    })

    return () => {
      removeListener()
    }
  }, [mutateDocuments, mutateFolders])

  return (
    <SharedDocumentsPage
      documents={documents || []}
      folders={folders || []}
      isLoading={docsLoading || foldersLoading}
      onDocumentsChange={docs => mutateDocuments(docs, { revalidate: false })}
      onFoldersChange={folders => mutateFolders(folders, { revalidate: false })}
    />
  )
}

export default ElectronDocumentsPage
