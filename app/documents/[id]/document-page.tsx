'use client'
import Editor from '@components/editor'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useAPI, useNavigation } from '@components/providers'
import { CloudIcon } from '@heroicons/react/solid'
import { useSpinner, useSyncHybridDoc } from '@lib/hooks'
import DocumentTree, { createTreeItems } from '@components/document-tree'
import { DocumentData, VersionData } from '@typez/globals'
import { useUser } from '@wrappers/auth-wrapper-client'
import { useCallback, useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useDebouncedCallback } from 'use-debounce'
import { motion, AnimatePresence } from 'framer-motion'
import { EyeIcon, EyeOffIcon, ClockIcon } from '@heroicons/react/outline'
import VersionList from '@components/version-list'
import { Dialog } from '@mui/material'

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
      content: data.content
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
  const { getLocation, navigateTo } = useNavigation()
  const location = getLocation()
  const id = location.split('/').pop()?.split('?')[0] || ''
  const { get, patch } = useAPI()
  const save = useSave()
  const pathname = getLocation()

  const api = useAPI()
  const fetcher = useCallback(
    async (path: string) => {
      return await get(path)
    },
    [get],
  )

  const searchParams = new URLSearchParams(window.location.search)
  const shouldFocusTitle = searchParams.get('focus') === 'title'
  const documentPath = `/documents/${id}`

  const { data: databaseDoc } = useSWR<DocumentData, Error>(documentPath, fetcher)
  const { data: allDocs } = useSWR<DocumentData[], Error>('/documents', fetcher)
  const { data: allFolders } = useSWR<DocumentData[], Error>('/folders', fetcher)
  
  const [hybridDoc, setHybridDoc] = useState<DocumentData | null>()
  useSyncHybridDoc(id, databaseDoc, setHybridDoc)

  // Track document state changes
  useEffect(() => {
    console.log('Document state changed:', {
      id,
      databaseDoc,
      hybridDoc,
      hasHybridDoc: !!hybridDoc,
      hasDatabaseDoc: !!databaseDoc,
      content: hybridDoc?.content
    })
  }, [id, databaseDoc, hybridDoc])

  const showSpinner = useSpinner(!hybridDoc)

  const { isLoading } = useUser()
  const [initAnimate, setInitAnimate] = useState(false)
  const [recentlySaved, setRecentlySaved] = useState(false)
  const skipAnimation = searchParams.get('from') === 'tree'
  const [showTree, setShowTree] = useState(true)
  const [showVersions, setShowVersions] = useState(false)
  const [diffContent, setDiffContent] = useState<any>(null)

  const debouncedSave = useDebouncedCallback((data: Partial<DocumentData>) => {
    console.log('Debounced save triggered:', {
      data,
      id,
      currentHybridDoc: hybridDoc
    })
    mutate(`/documents/${id}/versions`)
    save(data, id, setRecentlySaved)
    mutate(documentPath)
  }, 1000)

  useEffect(() => {
    setTimeout(() => setRecentlySaved(false), 2010)
  }, [recentlySaved])

  useEffect(() => {
    if (skipAnimation) {
      setInitAnimate(true)
      return
    }

    setTimeout(() => {
      setInitAnimate(true)
    }, 250)
  }, [isLoading, skipAnimation])

  const handlePrimaryAction = (item: any) => {
    const selectedId = item.index.toString()
    navigateTo(`/documents/${selectedId}?from=tree`)
  }

  const handleRestoreVersion = async (version: VersionData) => {
    if (!version || !id) return

    try {
      await patch(`/documents/${id}`, {
        content: version.content,
        lastUpdated: Date.now()
      })
      
      const updatedDoc = {
        ...hybridDoc,
        content: version.content,
        lastUpdated: Date.now()
      }

      if (process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'json') {
        sessionStorage.setItem(id, JSON.stringify(updatedDoc))
      }
      
      await Promise.all([
        mutate(documentPath, updatedDoc, true),
        mutate(`/hybrid-documents/${id}`, updatedDoc, true)
      ])
    } catch (e) {
      console.error('Error in restore process:', e)
    }
  }

  if (!hybridDoc) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse text-black/50">Loading document...</div>
      </div>
    )
  }

  return (
    <Layout documentId={id}>
      {!skipAnimation && (
        <>
          <div className={`gradient ${initAnimate ? 'opacity-0' : 'opacity-100'} ${backdropStyles}`} />
          <div 
            className={`gradient-editor ${initAnimate ? 'opacity-100' : 'opacity-0'} ${backdropStyles}`} 
          />
        </>
      )}
      {skipAnimation && (
        <div className="fixed top-0 left-0 h-screen w-screen z-[-1] gradient-editor" />
      )}
      {recentlySaved && (
        <div className={`fixed right-[30px] top-0 z-[40] p-[20px]`}>
          <CloudIcon className="h-[20px] w-[20px] animate-bounce self-center fill-black/[.10] md:h-[24px] md:w-[24px] md:fill-black/[.15]" />
        </div>
      )}
      <div className="flex h-screen">
        {/* Control Buttons */}
        <div className="fixed top-[41px] left-[18px] z-50 flex gap-2">
          <button 
            onClick={() => setShowTree(!showTree)}
            className="p-1.5 rounded-lg hover:bg-white/[.1] transition-colors"
          >
            {showTree ? (
              <EyeIcon className="w-4 h-4 text-black/70" />
            ) : (
              <EyeOffIcon className="w-4 h-4 text-black/70" />
            )}
          </button>
          <button 
            onClick={() => setShowVersions(!showVersions)}
            className="p-1.5 rounded-lg hover:bg-white/[.1] transition-colors"
          >
            <ClockIcon className="w-4 h-4 text-black/70" />
          </button>
        </div>

        {/* Document Tree */}
        <AnimatePresence initial={false}>
          {showTree && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
              transition={{ 
                opacity: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
                scale: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
                filter: { duration: 0.4, ease: [0.23, 1, 0.32, 1] }
              }}
              style={{ willChange: "filter" }}
              className="lg:fixed lg:left-0 lg:top-0 w-[320px] pt-[44px] h-screen shrink-0"
            >
              <div className="h-[calc(100vh_-_44px)] p-4 overflow-y-auto">
                {allDocs && allFolders && (
                  <DocumentTree
                    items={createTreeItems(allDocs, allFolders)}
                    onPrimaryAction={handlePrimaryAction}
                    showActionButton={false}
                    className="h-full"
                    persistExpanded={true}
                    theme="dark"
                    showSelectedStyles={false}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Versions Sidebar */}
        <AnimatePresence initial={false}>
          {showVersions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(8px)" }}
              transition={{ 
                opacity: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
                scale: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
                filter: { duration: 0.4, ease: [0.23, 1, 0.32, 1] }
              }}
              style={{ willChange: "filter" }}
              className="fixed right-0 top-0 w-[320px] pt-[44px] h-screen shrink-0 bg-white/[.02] backdrop-blur-xl"
            >
              <div className="h-[calc(100vh_-_44px)] p-4 overflow-y-auto">
                <VersionList 
                  documentId={id} 
                  onRestore={handleRestoreVersion}
                  onCompare={setDiffContent}
                  currentContent={hybridDoc.content}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor Container */}
        <div className="flex-1 flex justify-center lg:justify-center">
          {/* Editor */}
          <div
            id="editor-container"
            className={`overflow-y-scroll p-[20px] pb-10 font-editor2 text-black/[.79] w-full lg:w-[740px]`}>
            <div
              className={`
                flex transition-flex
                duration-500 ease-in ${showSpinner ? 'mt-[-36px] flex-col justify-center' : ''}
                relative pb-10`}>
              {showSpinner && <Loader />}
              {hybridDoc && (
                <Editor
                  content={diffContent || hybridDoc.content}
                  title={hybridDoc.title}
                  onUpdate={debouncedSave}
                  canEdit={!diffContent}
                  hideFooter={!!diffContent}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}