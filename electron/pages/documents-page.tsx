import SharedDocumentsPage from '@components/shared-documents-page'
import { DocumentData, FolderData } from '@typez/globals'
import useSWR from 'swr'

const ElectronDocumentsPage = () => {
  const { data: documents, mutate: mutateDocuments, isLoading: docsLoading } = useSWR<DocumentData[]>(
    '/documents',
    window.electronAPI.get,
    { 
      revalidateOnFocus: false,
      focusThrottleInterval: 30000,
      dedupingInterval: 10000,
      revalidateIfStale: false
    }
  )

  const { data: folders, mutate: mutateFolders, isLoading: foldersLoading } = useSWR<FolderData[]>(
    '/folders',
    window.electronAPI.get,
    {
      revalidateOnFocus: false,
      focusThrottleInterval: 30000,
      dedupingInterval: 10000,
      revalidateIfStale: false
    }
  )

  return (
    <SharedDocumentsPage 
      documents={documents || []}
      folders={folders || []}
      isLoading={docsLoading || foldersLoading}
      onDocumentsChange={(docs) => mutateDocuments(docs, { revalidate: false })}
      onFoldersChange={(folders) => mutateFolders(folders, { revalidate: false })}
    />
  )
}

export default ElectronDocumentsPage 