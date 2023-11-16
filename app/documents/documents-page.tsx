'use client'
import SharedDocumentsPage from '@components/shared-documents-page'
import { useDocSync } from '@lib/hooks'
import API from '@lib/http-utils'
import { withPageAuthRequired } from '@wrappers/auth-wrapper-client'
import { useCallback } from 'react'
import { useSWRConfig } from 'swr'

export const NextDocumentsPage = () => {
  const { docs, mutate, isLoading } = useDocSync()
  const { cache } = useSWRConfig()

  const deleteDocument = useCallback(
    async (id: string) => {
      const updatedDocs = docs.filter(doc => doc.id !== id)
      mutate(updatedDocs, false)
      try {
        await API.delete(`/api/documents/${id}`)
      } catch (e) {
        console.log(e)
        mutate()
      }
    },
    [mutate, docs],
  )

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      const updatedDocs = docs.map(doc => (doc.id === id ? { ...doc, title } : doc))
      mutate(updatedDocs, false)
      try {
        await API.patch(`/api/documents/${id}`, {
          title,
          lastUpdated: Date.now(),
        })
      } catch (e) {
        console.log(e)
        mutate()
      }

      cache.delete(`/api/documents/${id}`)
    },
    [mutate, docs, cache],
  )

  return (
    <SharedDocumentsPage
      docs={docs}
      deleteDocument={deleteDocument}
      renameDocument={renameDocument}
      isLoading={isLoading}
    />
  )
}

export default withPageAuthRequired(NextDocumentsPage)
