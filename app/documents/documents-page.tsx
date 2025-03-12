'use client'
import SharedDocumentsPage from '@components/shared-documents-page'
import { withPageAuthRequired } from '@wrappers/auth-wrapper-client'
import { useAPI } from '@components/providers'
import useSWR from 'swr'
import { DocumentData, FolderData } from '@typez/globals'

export const NextDocumentsPage = () => {
  const { get } = useAPI()
  const {
    data: documents,
    mutate: mutateDocuments,
    isLoading: docsLoading,
  } = useSWR<DocumentData[]>('/documents', get)
  const {
    data: folders,
    mutate: mutateFolders,
    isLoading: foldersLoading,
  } = useSWR<FolderData[]>('/folders', get)

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

export default withPageAuthRequired(NextDocumentsPage)
