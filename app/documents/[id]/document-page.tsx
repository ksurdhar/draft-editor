'use client'
import Editor from '@components/editor'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useAPI, useNavigation } from '@components/providers'
import { CloudIcon } from '@heroicons/react/solid'
import { useSpinner, useSyncHybridDoc } from '@lib/hooks'

import { DocumentData } from '@typez/globals'
import { useUser } from '@wrappers/auth-wrapper-client'

import { useCallback, useEffect, useState } from 'react'
import { createEditor } from 'slate'
import { withHistory } from 'slate-history'
import { withReact } from 'slate-react'
import useSWR, { mutate } from 'swr'
import { useDebouncedCallback } from 'use-debounce'

const backdropStyles = `
  fixed top-0 left-0 h-screen w-screen z-[-1]
  transition-opacity ease-in-out duration-[3000ms]
`

const useSave = () => {
  const { patch } = useAPI()

  const save = async (data: Partial<DocumentData>, id: string, setRecentlySaved: (bool: boolean) => void) => {
    const updatedData = {
      ...data,
      lastUpdated: Date.now(),
    }

    const cachedDoc = JSON.parse(sessionStorage.getItem(id) || '{}')
    const documentCached = Object.keys(cachedDoc).length > 0
    if (documentCached) {
      sessionStorage.setItem(id, JSON.stringify({ ...cachedDoc, ...updatedData }))
    }

    const path = `/documents/${id}`
    await patch(path, updatedData)

    setRecentlySaved(true)
  }

  return save
}

export default function DocumentPage() {
  const { getLocation } = useNavigation()
  const save = useSave()
  const pathname = getLocation()

  const api = useAPI()
  const fetcher = useCallback(
    async (path: string) => {
      return await api.get(path)
    },
    [api],
  )

  const id = (pathname || '').split('/').pop()?.split('?')[0] || ''
  const searchParams = new URLSearchParams(pathname?.split('?')[1] || '')
  const shouldFocusTitle = searchParams.get('focus') === 'title'
  const [editor] = useState(() => withReact(withHistory(createEditor())))
  const documentPath = `/documents/${id}`

  const { data: databaseDoc } = useSWR<DocumentData, Error>(documentPath, fetcher)
  const [hybridDoc, setHybridDoc] = useState<DocumentData | null>()
  useSyncHybridDoc(id, databaseDoc, setHybridDoc)

  const showSpinner = useSpinner(!hybridDoc)

  const { isLoading } = useUser()
  const [initAnimate, setInitAnimate] = useState(false)
  const [recentlySaved, setRecentlySaved] = useState(false)

  const debouncedSave = useDebouncedCallback((data: Partial<DocumentData>) => {
    mutate(`/documents/${id}/versions`)
    save(data, id, setRecentlySaved)
    mutate(documentPath)
 
  }, 1000)

  useEffect(() => {
    setTimeout(() => setRecentlySaved(false), 2010)
  }, [recentlySaved])

  useEffect(() => {
    setTimeout(() => {
      setInitAnimate(true)
    }, 250)
  }, [isLoading, setInitAnimate])

  return (
    <Layout documentId={id}>
      <div className={`gradient ${initAnimate ? 'opacity-0' : 'opacity-100'} ${backdropStyles}`} />
      <div className={`gradient-editor ${initAnimate ? 'opacity-100' : 'opacity-0'} ${backdropStyles}`} />
      {recentlySaved && (
        <div className={`fixed right-[30px] top-0 z-[40] p-[20px]`}>
          <CloudIcon className="h-[20px] w-[20px] animate-bounce self-center fill-black/[.10] md:h-[24px] md:w-[24px] md:fill-black/[.15]" />
        </div>
      )}
      <div
        id="editor-container"
        className={`flex h-[100vh] justify-center overflow-y-scroll p-[20px] pb-10 font-editor2 text-black/[.79]`}>
        <div
          className={`
            flex transition-flex
            duration-500 ease-in ${showSpinner ? 'mt-[-36px] flex-col justify-center' : ''}
            relative min-w-[calc(100vw_-_40px)] max-w-[740px] pb-10 md:min-w-[0px]`}>
          {showSpinner && <Loader />}
          {hybridDoc && (
            <Editor
              id={id}
              text={JSON.parse(hybridDoc.content)}
              editor={editor}
              title={hybridDoc.title}
              onUpdate={data => {
                debouncedSave(data)
              }}
              canEdit={!!hybridDoc.canEdit}
              shouldFocusTitle={shouldFocusTitle}
            />
          )}
        </div>
      </div>
    </Layout>
  )
}
