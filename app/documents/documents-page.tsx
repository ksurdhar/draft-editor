'use client'

import SharedDocumentsPage from '@components/shared-documents-page'
import API from '@lib/http-utils'
import { DocumentData } from '@typez/globals'
import { withPageAuthRequired } from '@wrappers/auth-wrapper-client'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import useSWR, { useSWRConfig } from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

const useDocSync = () => {
  const { data: docs = [], mutate, isLoading } = useSWR<DocumentData[]>('/api/documents', fetcher)
  useEffect(() => {
    docs?.forEach(doc => {
      sessionStorage.setItem(doc.id, JSON.stringify(doc))
    })
  }, [docs])
  return { docs, mutate, isLoading }
}

const DocumentsPage = () => {
  const { docs, mutate, isLoading } = useDocSync()
  const { cache } = useSWRConfig()

  const router = useRouter()

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

  const navigateTo = useCallback(
    (path: string) => {
      router.push(path)
    },
    [router],
  )

  return (
    <SharedDocumentsPage
      docs={docs}
      deleteDocument={deleteDocument}
      renameDocument={renameDocument}
      navigateTo={navigateTo}
      isLoading={isLoading}
    />
  )
}

export default withPageAuthRequired(DocumentsPage)
