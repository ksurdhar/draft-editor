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
import { useCallback, useEffect, useState, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { useDebouncedCallback } from 'use-debounce'
import { motion, AnimatePresence } from 'framer-motion'
import {
  EyeIcon,
  EyeOffIcon,
  ClockIcon,
  SearchIcon,
  ChatIcon,
  CodeIcon,
  DocumentIcon,
} from '@heroicons/react/outline'
import VersionList from '@components/version-list'
import GlobalFind from '@components/global-find'
import { DialogueList, useDialogue } from '@components/dialogue'
import { SceneList } from './scene'
import { renameItem, DocumentOperations } from '@lib/document-operations'
import DebugPanel from './debug-panel'

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
  const { get, patch, post } = useAPI()
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
  const { data: allDocs } = useSWR<DocumentData[], Error>('/documents?metadataOnly=true', fetcher)
  const { data: allFolders } = useSWR<DocumentData[], Error>('/folders', fetcher)

  const [hybridDoc, setHybridDoc] = useState<DocumentData | null>()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [currentContent, setCurrentContent] = useState<any>(null)
  const [editor, setEditor] = useState<any>(null)
  const [initAnimate, setInitAnimate] = useState(false)
  const [isDialogueMode, setIsDialogueMode] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [showScenes, setShowScenes] = useState(false)
  const [focusedSceneId, setFocusedSceneId] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [showDialogue, setShowDialogue] = useState(false)
  const [showGlobalFind, setShowGlobalFind] = useState(false)
  const [diffContent, setDiffContent] = useState<any>(null)
  const [showInitialLoader, setShowInitialLoader] = useState(false)
  const [dialogueDoc, setDialogueDoc] = useState<any>(null)

  useEffect(() => {
    if (databaseDoc) {
      setHybridDoc(databaseDoc)
    }
  }, [databaseDoc])

  // Use the current document's content or fall back to hybrid doc
  const documentContent = currentContent || hybridDoc?.content

  // Ensure we have valid arrays for the document tree
  const safeAllDocs = allDocs || []
  const safeAllFolders = allFolders || []

  // Handle document content updates - split into two effects
  useEffect(() => {
    const loadDocument = async (docId: string) => {
      // Only skip if we have content for this specific document and we're not in transition
      if (currentContent && docId === documentId && !isTransitioning) {
        // console.log('Skipping load - already have content for this document')
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
  const [recentlySaved, setRecentlySaved] = useState(false)
  const skipAnimation = searchParams.get('from') === 'tree'
  const [showTree, setShowTree] = useState(true)

  const debouncedSave = useDebouncedCallback((data: Partial<DocumentData>) => {
    mutate(`/documents/${documentId}/versions`)
    save(data, documentId, setRecentlySaved)

    mutate(documentPath, async () => {
      const freshDoc = await get(`/documents/${documentId}`)
      return freshDoc
    })

    if (data.title && allDocs) {
      mutate(
        '/documents',
        allDocs.map(doc => (doc._id === documentId ? { ...doc, title: data.title } : doc)),
        false,
      )
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

  const handleRename = async (itemId: string, newName: string) => {
    try {
      await renameItem(
        itemId,
        newName,
        allDocs || [],
        allFolders || [],
        operations,
        (updatedDocs, updatedFolders) => {
          mutate('/documents', updatedDocs)
          mutate('/folders', updatedFolders)
          mutate(`/documents/${itemId}`)
          mutate(documentPath)
        },
        {
          currentDocumentId: documentId,
          setHybridDoc,
          setCurrentContent,
        },
      )
    } catch (error) {
      console.error('Failed to rename item:', error)
    }
  }

  const operations = useMemo<DocumentOperations>(
    () => ({
      patchDocument: (id: string, data: any) => patch(`documents/${id}`, data),
      patchFolder: (id: string, data: any) => patch(`folders/${id}`, data),
      bulkDeleteItems: (documentIds: string[], folderIds: string[]) =>
        post('documents/bulk-delete', { documentIds, folderIds }),
      createDocument: async (data: any) => {
        const response = await post('/documents', data)
        return response
      },
      renameItem: async (itemId, newName, docs, folders, ops, onUpdate) => {
        await renameItem(itemId, newName, docs, folders, ops, onUpdate)
      },
    }),
    [patch, post],
  )

  const handleEditorReady = (editorInstance: any) => {
    setEditor(editorInstance)

    // Apply initial scene highlighting state
    if (editorInstance && editorInstance.isEditable) {
      editorInstance.commands.setSceneHighlight(!!showScenes)
    }
  }

  const {
    handleConfirmDialogue,
    syncDialogue,
    isSyncingDialogue,
    handleUpdateConversationName,
    focusedConversationId,
    toggleConversationFocus,
    removeAllDialogueMarks,
  } = useDialogue(editor, documentId, documentContent, post, debouncedSave, {
    setCurrentContent,
    setDialogueDoc,
    isDialogueMode,
  })

  const handleToggleFocusScene = (sceneId: string) => {
    setFocusedSceneId(focusedSceneId === sceneId ? null : sceneId)
  }

  const handleUpdateSceneTitle = (sceneId: string, newTitle: string) => {
    if (editor) {
      editor.commands.updateSceneTitle(sceneId, newTitle)
    }
  }

  const handleAddScene = () => {
    if (editor) {
      editor.commands.createScene()
    }
  }

  // Toggle scene highlighting when showScenes changes
  useEffect(() => {
    if (editor && editor.isEditable) {
      editor.commands.setSceneHighlight(!!showScenes)
    }
  }, [showScenes, editor])

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
      <div className="flex h-[calc(100vh)]">
        {/* Left Sidebar Container */}
        <div className="h-screen w-[320px] shrink-0 pt-[60px]">
          {/* Control Buttons */}
          <div className="relative z-50 px-4 pb-2">
            <div className="pointer-events-auto flex gap-2">
              <button
                onClick={() => {
                  setShowTree(!showTree)
                  if (!showTree) {
                    setShowGlobalFind(false)
                    setShowDialogue(false)
                    setShowScenes(false)
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
                    setShowDialogue(false)
                    setShowScenes(false)
                  }
                }}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/[.1]"
                title={showGlobalFind ? 'Hide global find' : 'Show global find'}>
                <SearchIcon className="h-4 w-4 text-black/70" />
              </button>
              <button
                onClick={() => {
                  setShowVersions(!showVersions)
                  if (!showVersions) {
                    setShowDialogue(false)
                    setShowScenes(false)
                    setDiffContent(null)
                  }
                }}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/[.1]"
                title={showVersions ? 'Hide versions' : 'Show versions'}>
                <ClockIcon className="h-4 w-4 text-black/70" />
              </button>
              <button
                onClick={() => {
                  const newShowDialogue = !showDialogue
                  setShowDialogue(newShowDialogue)
                  setIsDialogueMode(newShowDialogue)
                  if (editor) {
                    // Use command to update dialogue mode in editor
                    editor.commands.setDialogueMode(newShowDialogue)

                    // Also ensure scene mode is disabled when dialogue mode is enabled
                    if (newShowDialogue) {
                      editor.commands.setSceneMode(false)
                    }
                  }
                  if (newShowDialogue) {
                    // Disable other modes when dialogue mode is enabled
                    setShowScenes(false)
                  }
                  if (!newShowDialogue) {
                    setShowVersions(false)
                    setDiffContent(null)
                  }
                }}
                className={`rounded-lg p-1.5 transition-colors hover:bg-white/[.1] ${
                  showDialogue ? 'bg-white/[.1]' : ''
                }`}
                title={showDialogue ? 'Hide dialogue' : 'Show dialogue'}>
                <ChatIcon className="h-4 w-4 text-black/70" />
              </button>
              <button
                onClick={() => {
                  const newShowScenes = !showScenes
                  setShowScenes(newShowScenes)
                  if (editor) {
                    // Use command to update scene mode and highlighting in editor
                    editor.commands.setSceneMode(newShowScenes)
                    editor.commands.setSceneHighlight(newShowScenes)

                    // Also ensure dialogue mode is disabled when scene mode is enabled
                    if (newShowScenes) {
                      editor.commands.setDialogueMode(false)
                    }
                  }
                  if (newShowScenes) {
                    // Disable other modes when scene mode is enabled
                    setShowDialogue(false)
                    setIsDialogueMode(false)
                  }
                  if (!newShowScenes) {
                    setShowVersions(false)
                    setDiffContent(null)
                  }
                }}
                className={`rounded-lg p-1.5 transition-colors hover:bg-white/[.1] ${
                  showScenes ? 'bg-white/[.1]' : ''
                }`}
                title={showScenes ? 'Hide scenes' : 'Show scenes'}>
                <DocumentIcon className="h-4 w-4 text-black/70" />
              </button>
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="rounded-lg p-1.5 transition-colors hover:bg-white/[.1]"
                title={showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel'}>
                <CodeIcon className="h-4 w-4 text-black/70" />
              </button>
            </div>
          </div>

          {/* Document Tree or Global Find */}
          <div className="relative">
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
                  className="absolute inset-x-0 h-[calc(100vh-100px)]">
                  {showTree && allDocs && allFolders && (
                    <div className="h-full overflow-y-auto px-4">
                      <DocumentTree
                        key="document-tree"
                        items={createTreeItems(safeAllDocs, safeAllFolders)}
                        onPrimaryAction={handlePrimaryAction}
                        onRename={handleRename}
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
          </div>
        </div>

        {/* Editor Container */}
        <div className="flex flex-1 justify-center">
          {!hybridDoc ? (
            <div className="flex h-[calc(100vh_-_44px)] items-center justify-center">
              {showInitialLoader && <Loader />}
            </div>
          ) : (
            <div
              id="editor-container"
              className={`w-full overflow-y-scroll pb-10 font-editor2 text-black/[.79] lg:w-[740px]`}>
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
                        onUpdate={data => {
                          debouncedSave(data)
                        }}
                        canEdit={!diffContent}
                        hideFooter={!!diffContent}
                        onEditorReady={handleEditorReady}
                        isDialogueMode={isDialogueMode}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Container - Always present */}
        <div className="w-[320px] shrink-0 pt-[60px]">
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
                className="h-screen w-full bg-white/[.02] backdrop-blur-xl">
                <div className="h-[calc(100vh_-_60px)] overflow-y-auto p-4">
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

          {/* Dialogue Sidebar */}
          <AnimatePresence initial={false}>
            {showDialogue && (
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
                className="h-screen w-full bg-white/[.02] backdrop-blur-xl">
                <div className="h-[calc(100vh_-_60px)] overflow-y-auto p-4">
                  <DialogueList
                    editor={editor}
                    documentId={documentId}
                    currentContent={dialogueDoc}
                    onSyncDialogue={syncDialogue}
                    isSyncing={isSyncingDialogue}
                    onConfirmDialogue={handleConfirmDialogue}
                    focusedConversationId={focusedConversationId}
                    onToggleFocus={toggleConversationFocus}
                    onUpdateConversationName={handleUpdateConversationName}
                    onRemoveAllDialogueMarks={removeAllDialogueMarks}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scene Sidebar */}
          <AnimatePresence initial={false}>
            {showScenes && (
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
                className="h-screen w-full bg-white/[.02] backdrop-blur-xl">
                <div className="h-[calc(100vh_-_60px)] overflow-y-auto p-4">
                  <SceneList
                    editor={editor}
                    documentId={documentId}
                    onUpdateSceneTitle={handleUpdateSceneTitle}
                    focusedSceneId={focusedSceneId}
                    onToggleFocus={handleToggleFocusScene}
                    onAddScene={handleAddScene}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---- Debug Panel ---- */}
        <AnimatePresence>
          {showDebugPanel && (
            <DebugPanel content={documentContent} onClose={() => setShowDebugPanel(false)} />
          )}
        </AnimatePresence>
      </div>
    </Layout>
  )
}
