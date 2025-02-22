import { useCallback, useEffect, useState } from 'react'
import SharedDocumentsPage from '@components/shared-documents-page'
import { DocumentData, FolderData } from '@typez/globals'

const ElectronDocumentsPage = () => {
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [folders, setFolders] = useState<FolderData[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [docsResult, foldersResult] = await Promise.all([
        window.electronAPI.get('/documents'),
        window.electronAPI.get('/folders')
      ])
      setDocuments(docsResult)
      setFolders(foldersResult)
    } catch (error) {
      console.error('Error fetching documents/folders:', error)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <SharedDocumentsPage 
      documents={documents}
      folders={folders}
      isLoading={isLoading}
      onDocumentsChange={setDocuments}
      onFoldersChange={setFolders}
    />
  )
}

export default ElectronDocumentsPage 