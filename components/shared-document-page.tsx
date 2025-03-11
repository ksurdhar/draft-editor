'use client'
import Editor from '@components/editor'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useAPI, useNavigation } from '@components/providers'
import { CloudIcon } from '@heroicons/react/solid'
// Temporarily not using useSyncHybridDoc
// import { useSyncHybridDoc } from '@lib/hooks'
import DocumentTree, { createTreeItems } from '@components/document-tree'
import { DocumentData, VersionData } from '@typez/globals'
import { useUser } from '@wrappers/auth-wrapper-client'
import { useCallback, useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useDebouncedCallback } from 'use-debounce'
import { motion, AnimatePresence } from 'framer-motion'
import { EyeIcon, EyeOffIcon, ClockIcon, SearchIcon } from '@heroicons/react/outline'
import VersionList from '@components/version-list'
import GlobalFind from '@components/global-find'

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
      content: data.content,
    }

    const cachedDoc = JSON.parse(sessionStorage.getItem(id) || '{}')
    const documentCached = Object.keys(cachedDoc).length > 0
    if (documentCached) {
      // Ensure we preserve the title when caching the document
      sessionStorage.setItem(
        id,
        JSON.stringify({
          ...cachedDoc,
          ...updatedData,
          title: data.title || cachedDoc.title, // Preserve existing title if not in update data
        }),
      )
    }

    const path = `/documents/${id}`
    await patch(path, updatedData)
    setRecentlySaved(true)
  }

  return save
}

export default function SharedDocumentPage() {
  const { getLocation, navigateTo } = useNavigation()
  const location = getLocation()
  const id = location.split('/').pop()?.split('?')[0] || ''
  const { get, patch } = useAPI()
  const save = useSave()

  const fetcher = useCallback(
    async (path: string) => {
      return await get(path)
    },
    [get],
  )

  const searchParams = new URLSearchParams(window.location.search)
  const documentId = searchParams.get('documentId') || id
  const documentPath = `/documents/${documentId}`

  // Update URL when document ID changes
  useEffect(() => {
    if (documentId && documentId !== id) {
      const newUrl = `/documents/${id}?documentId=${documentId}`
      window.history.pushState({}, '', newUrl)
    }
  }, [documentId, id])

  const { data: databaseDoc } = useSWR<DocumentData, Error>(documentPath, fetcher)
  const { data: allDocs } = useSWR<DocumentData[], Error>('/documents', fetcher)
  const { data: allFolders } = useSWR<DocumentData[], Error>('/folders', fetcher)

  const [hybridDoc, setHybridDoc] = useState<DocumentData | null>()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [currentContent, setCurrentContent] = useState<any>(null)

  useEffect(() => {
    if (databaseDoc) {
      setHybridDoc(databaseDoc)
    }
  }, [databaseDoc])

  // Use the current document's content or fall back to hybrid doc
  const documentContent = currentContent || hybridDoc?.content

  // Handle document content updates - split into two effects
  useEffect(() => {
    const loadDocument = async (docId: string) => {
      console.log('Loading document:', {
        docId,
        currentDocId: documentId,
        hasCurrentContent: !!currentContent,
        isTransitioning,
      })

      // Only skip if we have content for this specific document and we're not in transition
      if (currentContent && docId === documentId && !isTransitioning) {
        console.log('Skipping load - already have content for this document')
        return
      }

      setIsTransitioning(true)
      setCurrentContent(null)

      try {
        // Clear SWR cache for this document to ensure we get fresh data
        // This is especially important after title changes
        mutate(documentPath, undefined, false)

        // Get document from API
        const doc = await get(`/documents/${docId}`)
        console.log('Loaded document:', {
          docId,
          hasContent: !!doc.content,
          contentLength: doc.content?.content?.length,
        })

        // Check if we're still on the same document
        const currentDocId = new URLSearchParams(window.location.search).get('documentId') || id
        if (docId === currentDocId) {
          setCurrentContent(doc.content)

          // Update session storage cache with latest data
          sessionStorage.setItem(docId, JSON.stringify(doc))

          // Update hybrid doc state with full document data
          setHybridDoc(doc)
        } else {
          console.log('Document changed while loading, skipping update')
        }
      } catch (error) {
        console.error('Error loading document:', error)
        setCurrentContent(null)
      } finally {
        // Small delay to ensure smooth transition
        setTimeout(() => {
          setIsTransitioning(false)
        }, 100)
      }
    }

    // Load initial document
    if (documentId) {
      loadDocument(documentId)
    }
  }, [documentId, id, get]) // Removed currentContent and isTransitioning from deps

  // Separate effect for document change event listener
  useEffect(() => {
    const handleDocumentChange = () => {
      const newParams = new URLSearchParams(window.location.search)
      const newDocId = newParams.get('documentId') || id

      console.log('Document change event:', {
        newDocId,
        currentDocId: documentId,
        hasCurrentContent: !!currentContent,
        isTransitioning,
      })

      if (newDocId !== documentId) {
        // Reset state before loading new document
        setCurrentContent(null)
        setIsTransitioning(false)
      }
    }

    const handleDocumentChanging = (event: any) => {
      // Clear current content and set transitioning state to force fresh load
      setCurrentContent(null)
      setIsTransitioning(true)

      // Also invalidate the SWR cache for the document being navigated to
      const docId = event.detail?.documentId
      if (docId) {
        mutate(`/documents/${docId}`, undefined, false)
      }

      console.log('Document changing event:', {
        targetDocId: event.detail?.documentId,
        currentDocId: documentId,
      })
    }

    window.addEventListener('documentChanged', handleDocumentChange)
    window.addEventListener('documentChanging', handleDocumentChanging)

    return () => {
      window.removeEventListener('documentChanged', handleDocumentChange)
      window.removeEventListener('documentChanging', handleDocumentChanging)
    }
  }, [documentId, id])

  const showSpinner = !documentContent && isTransitioning

  const { isLoading } = useUser()
  const [initAnimate, setInitAnimate] = useState(false)
  const [recentlySaved, setRecentlySaved] = useState(false)
  const skipAnimation = searchParams.get('from') === 'tree'
  const [showTree, setShowTree] = useState(true)
  const [showVersions, setShowVersions] = useState(false)
  const [showGlobalFind, setShowGlobalFind] = useState(false)
  const [diffContent, setDiffContent] = useState<any>(null)
  const [showInitialLoader, setShowInitialLoader] = useState(false)

  const debouncedSave = useDebouncedCallback((data: Partial<DocumentData>) => {
    mutate(`/documents/${documentId}/versions`)
    save(data, documentId, setRecentlySaved)

    // When saving, force a refresh of the document data to prevent stale data
    mutate(documentPath, async () => {
      // Get fresh data from API after saving
      const freshDoc = await get(`/documents/${documentId}`)
      return freshDoc
    })

    // If the title is being updated, also update it in the allDocs array
    // This ensures the document tree shows the latest title immediately
    if (data.title && allDocs) {
      // Use the false parameter for optimistic UI update, then revalidate to trigger animations
      mutate(
        '/documents',
        allDocs.map(doc => (doc._id === documentId ? { ...doc, title: data.title } : doc)),
        false,
      )

      // After a brief delay, trigger a revalidation to ensure consistency
      // This also helps trigger the animation by causing a re-render
      setTimeout(() => {
        mutate('/documents')
      }, 100)
    }
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

  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    if (!hybridDoc) {
      timeoutId = setTimeout(() => {
        setShowInitialLoader(true)
      }, 1000)
    }
    return () => clearTimeout(timeoutId)
  }, [hybridDoc])

  const handlePrimaryAction = (item: any) => {
    const selectedId = item.index.toString()
    navigateTo(`/documents/${selectedId}?from=tree`)
  }

  const handleRestoreVersion = async (version: VersionData) => {
    if (!version || !documentId) return

    try {
      await patch(`/documents/${documentId}`, {
        content: version.content,
        lastUpdated: Date.now(),
      })

      const updatedDoc = {
        ...hybridDoc,
        content: version.content,
        lastUpdated: Date.now(),
      }

      // Use window.env for Electron environment variables
      const storageType = window.env?.NEXT_PUBLIC_STORAGE_TYPE || 'mongo'
      if (storageType !== 'json') {
        sessionStorage.setItem(documentId, JSON.stringify(updatedDoc))
      }

      await Promise.all([
        mutate(documentPath, updatedDoc, true),
        mutate(`/hybrid-documents/${documentId}`, updatedDoc, true),
      ])

      // Update current content to show restored version immediately
      setCurrentContent(version.content)
    } catch (e) {
      console.error('Error in restore process:', e)
    }
  }

  const handleToggleGlobalSearch = () => {
    if (!showGlobalFind) {
      // Opening global search - always close tree view
      setShowTree(false)
    }
    setShowGlobalFind(!showGlobalFind)
  }

  // Clear diff content when switching documents
  useEffect(() => {
    setDiffContent(null)
  }, [documentId])

  return (
    <Layout documentId={id} onToggleGlobalSearch={handleToggleGlobalSearch}>
      {!skipAnimation && (
        <>
          <div className={`gradient ${initAnimate ? 'opacity-0' : 'opacity-100'} ${backdropStyles}`} />
          <div className={`gradient-editor ${initAnimate ? 'opacity-100' : 'opacity-0'} ${backdropStyles}`} />
        </>
      )}
      {skipAnimation && <div className="gradient-editor fixed left-0 top-0 z-[-1] h-screen w-screen" />}
      {recentlySaved && (
        <div className={`fixed right-[30px] top-0 z-[40] p-[20px]`}>
          <CloudIcon className="h-[20px] w-[20px] animate-bounce self-center fill-black/[.10] md:h-[24px] md:w-[24px] md:fill-black/[.15]" />
        </div>
      )}
      <div className="flex h-screen">
        {/* Control Buttons */}
        <div className="fixed left-[18px] top-[41px] z-50 flex gap-2">
          <button
            onClick={() => {
              setShowTree(!showTree)
              if (!showTree) {
                setShowGlobalFind(false)
              }
            }}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/[.1]"
            title={showTree ? 'Hide document tree' : 'Show document tree'}>
            {showTree ? (
              <EyeIcon className="h-4 w-4 text-black/70" />
            ) : (
              <EyeOffIcon className="h-4 w-4 text-black/70" />
            )}
          </button>
          <button
            onClick={() => {
              setShowGlobalFind(!showGlobalFind)
              if (!showGlobalFind) {
                setShowTree(false)
              }
            }}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/[.1]"
            title={showGlobalFind ? 'Hide global find' : 'Show global find'}>
            <SearchIcon className="h-4 w-4 text-black/70" />
          </button>
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="rounded-lg p-1.5 transition-colors hover:bg-white/[.1]"
            title={showVersions ? 'Hide versions' : 'Show versions'}>
            <ClockIcon className="h-4 w-4 text-black/70" />
          </button>
        </div>

        {/* Document Tree or Global Find */}
        <AnimatePresence initial={false}>
          {(showTree || showGlobalFind) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
              transition={{
                opacity: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
                scale: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
                filter: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
              }}
              style={{ willChange: 'filter' }}
              className="h-screen w-[320px] shrink-0 pt-[44px] lg:fixed lg:left-0 lg:top-0">
              {showTree && allDocs && allFolders && (
                <div className="h-[calc(100vh_-_44px)] overflow-y-auto p-4">
                  <DocumentTree
                    key="document-tree"
                    items={createTreeItems(allDocs, allFolders)}
                    onPrimaryAction={handlePrimaryAction}
                    showActionButton={false}
                    className="h-full"
                    persistExpanded={true}
                    theme="dark"
                    showSelectedStyles={false}
                  />
                </div>
              )}
              {showGlobalFind && <GlobalFind onClose={() => setShowGlobalFind(false)} />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Versions Sidebar */}
        <AnimatePresence initial={false}>
          {showVersions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(8px)' }}
              transition={{
                opacity: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
                scale: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
                filter: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
              }}
              style={{ willChange: 'filter' }}
              className="fixed right-0 top-0 h-screen w-[320px] shrink-0 bg-white/[.02] pt-[44px] backdrop-blur-xl">
              <div className="h-[calc(100vh_-_44px)] overflow-y-auto p-4">
                <VersionList
                  documentId={documentId}
                  onRestore={handleRestoreVersion}
                  onCompare={setDiffContent}
                  currentContent={documentContent}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor Container */}
        <div className="flex flex-1 justify-center lg:justify-center">
          {!hybridDoc ? (
            <div className="flex h-[calc(100vh_-_44px)] items-center justify-center">
              {showInitialLoader && <Loader />}
            </div>
          ) : (
            <div
              id="editor-container"
              className={`w-full overflow-y-scroll p-[20px] pb-10 font-editor2 text-black/[.79] lg:w-[740px]`}>
              <div
                className={`flex transition-flex duration-500 ease-in ${showSpinner ? 'mt-[-36px] flex-col justify-center' : ''} relative pb-10`}>
                {showSpinner && <Loader />}
                <AnimatePresence mode="wait">
                  {documentContent && (
                    <motion.div
                      key={documentId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}>
                      <Editor
                        key={documentId}
                        content={diffContent || documentContent}
                        title={hybridDoc?.title || ''}
                        onUpdate={debouncedSave}
                        canEdit={!diffContent}
                        hideFooter={!!diffContent}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
