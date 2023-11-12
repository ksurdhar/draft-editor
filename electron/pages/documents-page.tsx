import BaseDocumentsPage from '@components/shared-documents-page'
import { DocumentData } from '@typez/globals'
import { useUser } from '@wrappers/next-auth0-client'
import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'wouter'

const ElectronDocumentsPage = () => {
  const [_, setLocation] = useLocation()
  const [docs, setDocs] = useState<DocumentData[]>([])
  const { isLoading } = useUser()

  useEffect(() => {
    const fetchDocuments = async () => {
      const result = await window.electronAPI.getDocuments()
      setDocs(result)
    }
    fetchDocuments()
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

  const navigateTo = useCallback(
    (path: string) => {
      setLocation(path)
    },
    [setLocation],
  )

  return (
    <BaseDocumentsPage
      docs={docs}
      deleteDocument={deleteDocument}
      renameDocument={renameDocument}
      isLoading={isLoading}
    />
  )
}

export default ElectronDocumentsPage
