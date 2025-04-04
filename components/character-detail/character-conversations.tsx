'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Paper, Typography, IconButton, Tooltip, Menu, MenuItem } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { useAPI } from '@components/providers'
import { useNavigation } from '@components/providers'
import { Loader } from '@components/loader'
import { debugLog } from '@lib/debug-logger'
import TiptapJsonRenderer from '@components/tiptap-json-renderer'
import EditorComponent from '@components/editor'
import { DocumentData } from '@typez/globals'
import { debounce } from '@lib/utils'

// --- Type definitions copied or adapted from CharacterDetailPage ---

// Basic Tiptap types (consider moving to a shared types file)
interface TiptapMark {
  type: string
  attrs?: Record<string, any>
}
interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  marks?: TiptapMark[]
  attrs?: Record<string, any>
}

// DialogueEntry type
interface DialogueEntry {
  characterId: string
  characterName: string
  documentId?: string
  documentTitle?: string
  contentNode: TiptapNode
}

// ConversationGroup type
interface ConversationGroup {
  conversationId: string
  documentId: string
  documentTitle: string
  entries: DialogueEntry[]
  lastUpdated?: number
}

// Extracted conversation extraction logic
const extractConversationsForCharacter = (
  documentContent: any,
  targetCharacterName: string,
  documentTitle: string,
  documentId: string,
): ConversationGroup[] => {
  const conversationsMap: Record<string, ConversationGroup> = {}
  let characterParticipates: Record<string, boolean> = {}

  const processNode = (node: TiptapNode) => {
    if (node.type === 'text' && node.marks) {
      node.marks.forEach((mark: TiptapMark) => {
        if (mark.type === 'dialogue' && mark.attrs?.conversationId && mark.attrs?.character && node.text) {
          const { conversationId, character } = mark.attrs
          if (!conversationsMap[conversationId]) {
            conversationsMap[conversationId] = {
              conversationId,
              documentId,
              documentTitle,
              entries: [],
              lastUpdated: Date.now(),
            }
            characterParticipates[conversationId] = false
          }
          conversationsMap[conversationId].entries.push({
            characterId: character,
            characterName: character,
            contentNode: { ...node },
            documentId: documentId,
            documentTitle: documentTitle,
          })
          if (character === targetCharacterName) {
            characterParticipates[conversationId] = true
          }
        }
      })
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(processNode)
    }
  }

  if (documentContent && typeof documentContent === 'object' && documentContent.type === 'doc') {
    let parsedContent: TiptapNode
    if (typeof documentContent === 'string') {
      try {
        parsedContent = JSON.parse(documentContent)
      } catch (e) {
        console.error('Failed to parse document content in extractConversationsForCharacter:', e)
        return []
      }
    } else {
      parsedContent = documentContent
    }
    processNode(parsedContent)
  } else if (documentContent && typeof documentContent !== 'object') {
    console.warn(
      'Extracting conversations from non-object content, attempting parse:',
      typeof documentContent,
    )
    try {
      const parsedContent = JSON.parse(documentContent)
      if (parsedContent && parsedContent.type === 'doc') {
        processNode(parsedContent)
      } else {
        console.error('Parsed content is not a valid Tiptap document.')
      }
    } catch (e) {
      console.error('Failed to parse non-object document content:', e)
      return []
    }
  }

  return Object.values(conversationsMap).filter(group => characterParticipates[group.conversationId])
}

// --- Component Definition ---

interface CharacterConversationsProps {
  characterName: string
  characterId?: string // Needed for potential PATCH operations
  onCharacterDocumentUpdate?: (updatedDocumentIds: string[]) => void // Callback to update parent
}

const CharacterConversations: React.FC<CharacterConversationsProps> = ({
  characterName,
  characterId: _characterId,
  onCharacterDocumentUpdate,
}) => {
  const { patch, get } = useAPI()
  const { navigateTo } = useNavigation()
  const [conversations, setConversations] = useState<ConversationGroup[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [editorModeMap, setEditorModeMap] = useState<Record<string, 'view' | 'edit'>>({})
  const [activeEditorInfo, setActiveEditorInfo] = useState<{
    conversationId: string | null
    documentId: string | null
    content: any
    isLoading: boolean
  }>({
    conversationId: null,
    documentId: null,
    content: null,
    isLoading: false,
  })
  const editorWrapperRef = useRef<HTMLDivElement>(null)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [menuDocumentId, setMenuDocumentId] = useState<string | null>(null)

  // Debounced save function
  const debouncedSave = useMemo(
    () =>
      debounce((data: Partial<DocumentData>) => {
        handleSaveEditedDocument(data)
      }, 1500), // Debounce save by 1.5 seconds
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeEditorInfo.documentId, activeEditorInfo.conversationId, characterName], // Recreate if active doc/convo changes
  )

  // Load conversations when character name changes
  useEffect(() => {
    if (characterName) {
      loadConversations(characterName)
    }
  }, [characterName])

  // Click outside editor logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Log event details for debugging typing issue
      console.log(`handleClickOutside triggered by event type: ${event.type}, target:`, event.target)

      // Check if the click target is the toggle button itself (or inside it)
      const targetElement = event.target as HTMLElement
      const toggleButton = targetElement.closest('[data-testid^="toggle-editor-"]')

      if (toggleButton) {
        // Click was on the toggle button, let handleToggleEditorMode handle it.
        console.log('Click detected on toggle button, ignoring for outside click logic.')
        return
      }

      // Original logic: Check if the click is outside the editor wrapper
      if (
        activeEditorInfo.conversationId &&
        editorWrapperRef.current &&
        event.target instanceof Node &&
        !editorWrapperRef.current.contains(event.target)
      ) {
        console.log(
          'Clicked outside active editor wrapper (or event was not stopped), switching back to view mode.',
        )
        const closingConversationId = activeEditorInfo.conversationId! // Capture id before state change
        setEditorModeMap(prevMap => ({
          ...prevMap,
          [closingConversationId]: 'view',
        }))
        setActiveEditorInfo({ conversationId: null, documentId: null, content: null, isLoading: false })
      }
    }

    if (activeEditorInfo.conversationId) {
      // Listen during the bubbling phase (default) instead of capture.
      // No setTimeout needed now.
      document.addEventListener('click', handleClickOutside)
      console.log(`Attaching click outside listener (bubbling) for ${activeEditorInfo.conversationId}`)

      // Cleanup function removes the listener
      return () => {
        document.removeEventListener('click', handleClickOutside)
        console.log(
          `Cleaning up click outside listener (bubbling) for ${activeEditorInfo.conversationId} during effect re-run or unmount`,
        )
      }
    } else {
      // Explicitly ensure listener is removed if no editor is active (redundant but safe)
      document.removeEventListener('click', handleClickOutside)
      console.log('Ensuring click outside listener (bubbling) is removed as no editor is active')
    }

    // Cleanup logic is handled by the return function within the if block.
  }, [activeEditorInfo.conversationId])

  // Function to load conversations (extracted and adapted)
  const loadConversations = useCallback(
    async (charName: string) => {
      setLoadingConversations(true)
      setConversations([]) // Clear previous conversations
      let updatedDocIdsMap = new Set<string>() // Track documents character appears in

      try {
        const allDocuments = await get('/documents')
        if (!allDocuments || allDocuments.length === 0) {
          setLoadingConversations(false) // Ensure loading stops
          return
        }

        const allConversationGroups: ConversationGroup[] = []
        for (const document of allDocuments) {
          try {
            let contentToParse = document.content
            if (typeof contentToParse === 'string') {
              try {
                contentToParse = JSON.parse(contentToParse)
              } catch (e) {
                console.error(`Failed to parse content for document ${document._id}:`, e)
                contentToParse = null
              }
            }

            if (contentToParse) {
              const groupsFromDoc = extractConversationsForCharacter(
                contentToParse,
                charName,
                document.title || 'Untitled Document',
                document._id,
              )
              if (groupsFromDoc.length > 0) {
                allConversationGroups.push(...groupsFromDoc)
                updatedDocIdsMap.add(document._id) // Add doc ID if character participates
              }
            }
          } catch (error) {
            console.error(`Error processing document ${document._id} for conversations:`, error)
          }
        }

        allConversationGroups.sort((a, b) => {
          if (a.documentTitle !== b.documentTitle) {
            return (a.documentTitle || '').localeCompare(b.documentTitle || '')
          }
          return a.conversationId.localeCompare(b.conversationId)
        })

        setConversations(allConversationGroups)

        // Inform parent about updated document IDs if callback provided
        if (onCharacterDocumentUpdate) {
          onCharacterDocumentUpdate(Array.from(updatedDocIdsMap))
        }
      } catch (error) {
        console.error('Error loading conversation groups:', error)
      } finally {
        setLoadingConversations(false)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [get, onCharacterDocumentUpdate],
  )

  // --- Event Handlers (extracted and adapted) ---

  const handleOptionsClick = (event: React.MouseEvent<HTMLElement>, documentId: string) => {
    event.stopPropagation()
    // Close active editor if open when opening menu
    if (activeEditorInfo.conversationId) {
      setEditorModeMap(prevMap => ({ ...prevMap, [activeEditorInfo.conversationId!]: 'view' }))
      setActiveEditorInfo({ conversationId: null, documentId: null, content: null, isLoading: false })
    }
    setMenuAnchorEl(event.currentTarget)
    setMenuDocumentId(documentId)
  }

  const handleOptionsClose = () => {
    setMenuAnchorEl(null)
    setMenuDocumentId(null)
  }

  const handleGoToDocument = () => {
    if (menuDocumentId) {
      navigateTo(`/documents/${menuDocumentId}`)
    }
    handleOptionsClose()
  }

  const handleToggleEditorMode = async (conversationId: string, documentId: string) => {
    const currentMode = editorModeMap[conversationId] || 'view'
    const isCurrentlyEditingThis = currentMode === 'edit'

    if (isCurrentlyEditingThis) {
      console.log(`Switching ${conversationId} from edit to view.`)
      setEditorModeMap(prevMap => ({ ...prevMap, [conversationId]: 'view' }))
      setActiveEditorInfo({ conversationId: null, documentId: null, content: null, isLoading: false })
      return
    }

    console.log(`Switching ${conversationId} from view to edit.`)
    if (activeEditorInfo.conversationId && activeEditorInfo.conversationId !== conversationId) {
      console.log(`Closing previously active editor: ${activeEditorInfo.conversationId}`)
      setEditorModeMap(prevMap => ({ ...prevMap, [activeEditorInfo.conversationId!]: 'view' }))
    }

    setActiveEditorInfo({ conversationId, documentId, content: null, isLoading: true })
    setEditorModeMap(prevMap => ({ ...prevMap, [conversationId]: 'edit' }))

    try {
      const fullDocument = await get(`/documents/${documentId}`)
      setActiveEditorInfo(prev => {
        if (prev.conversationId === conversationId) {
          if (fullDocument) {
            return { ...prev, content: fullDocument.content, isLoading: false }
          } else {
            console.error('Failed to fetch document content for editing.')
            return { ...prev, isLoading: false }
          }
        } else {
          console.log('Editor target changed during fetch, aborting content set.')
          return prev
        }
      })
      if (!fullDocument) {
        setEditorModeMap(prevMap => {
          if (prevMap[conversationId] === 'edit') {
            return { ...prevMap, [conversationId]: 'view' }
          }
          return prevMap
        })
      }
    } catch (error) {
      console.error('Error fetching document for editing:', error)
      setActiveEditorInfo(prev => {
        if (prev.conversationId === conversationId) {
          return { ...prev, isLoading: false }
        }
        return prev
      })
      setEditorModeMap(prevMap => {
        if (prevMap[conversationId] === 'edit') {
          return { ...prevMap, [conversationId]: 'view' }
        }
        return prevMap
      })
    }
  }

  // Original save function (now called by debounced version)
  const handleSaveEditedDocument = useCallback(
    async (updatedData: Partial<DocumentData>) => {
      console.log('handleSaveEditedDocument triggered. Active editor:', activeEditorInfo.conversationId)
      if (!activeEditorInfo.documentId || !activeEditorInfo.conversationId) {
        console.error('Cannot save: No active document/conversation ID.')
        return
      }
      try {
        // Capture details needed before async operation
        const docId = activeEditorInfo.documentId!
        const convoId = activeEditorInfo.conversationId!
        const savedContent = updatedData.content // Content that was just saved

        await patch(`/documents/${docId}`, {
          content: savedContent,
          lastUpdated: Date.now(),
        })
        console.log(`Document ${docId} saved successfully.`)

        // Now, update the local state *without* a full reload
        setConversations(prevConversations => {
          // Find the document title associated with this docId from existing state
          const docTitle =
            prevConversations.find(c => c.documentId === docId)?.documentTitle || 'Untitled Document'

          // Re-extract conversation entries JUST from the saved content
          const updatedGroups = extractConversationsForCharacter(
            savedContent, // Use the content we just saved
            characterName,
            docTitle,
            docId,
          )

          // Find the specific updated conversation group
          const updatedGroup = updatedGroups.find(g => g.conversationId === convoId)

          if (!updatedGroup) {
            console.warn('Could not find updated conversation group after save, list might be stale.')
            return prevConversations // Return previous state if extraction failed unexpectedly
          }

          // Map over the previous conversations and replace the updated one
          return prevConversations.map(convo => {
            if (convo.conversationId === convoId && convo.documentId === docId) {
              console.log(`Updating conversation ${convoId} in local state.`)
              return { ...convo, entries: updatedGroup.entries, lastUpdated: Date.now() } // Update entries and timestamp
            }
            return convo
          })
        })
      } catch (error) {
        console.error('Error saving document:', error)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [patch, activeEditorInfo.documentId, activeEditorInfo.conversationId, characterName],
  )

  // --- Rendering Logic --- //

  // Log state just before rendering
  console.log(
    'Rendering CharacterConversations. Active Editor:',
    activeEditorInfo.conversationId,
    'Editor Mode Map:',
    editorModeMap,
  )

  return (
    <Paper
      elevation={0}
      className="mb-6 overflow-hidden rounded-lg p-6"
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        height: 'calc(100vh - 120px)', // Adjust based on parent layout if needed
        display: 'flex',
        flexDirection: 'column',
      }}>
      <Typography variant="h5" className="mb-4 font-semibold">
        Character Conversations
      </Typography>

      <div className="flex-1 overflow-y-auto pr-2">
        {loadingConversations ? (
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Typography variant="body2" className="text-center text-black/[.6]">
              No conversations found involving this character.
            </Typography>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(
              conversations.reduce(
                (groups, convo) => {
                  const key = convo.documentTitle || 'Unknown Document'
                  if (!groups[key]) groups[key] = []
                  groups[key].push(convo)
                  return groups
                },
                {} as Record<string, ConversationGroup[]>,
              ),
            ).map(([documentTitle, convosInDoc]) => (
              <div key={documentTitle} className="mb-6">
                <Typography variant="subtitle1" className="mb-2 border-b border-white/20 pb-2 font-medium">
                  {documentTitle}
                </Typography>
                <div className="space-y-3">
                  {convosInDoc.map((convo: ConversationGroup) => {
                    const currentMode = editorModeMap[convo.conversationId] || 'view'
                    const isEditingThisConversation = currentMode === 'edit'
                    const isActiveEditorLoading =
                      activeEditorInfo.isLoading && activeEditorInfo.conversationId === convo.conversationId

                    debugLog(
                      `Rendering convo ${convo.conversationId}: mode = ${currentMode}, isLoading = ${isActiveEditorLoading}`,
                    )

                    return (
                      <Paper
                        key={convo.conversationId}
                        elevation={0}
                        className={`overflow-visible rounded-lg transition-all hover:bg-opacity-20 ${isEditingThisConversation ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent' : ''}`}
                        sx={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
                          position: 'relative',
                        }}>
                        <div
                          className="sticky top-0 z-10 flex items-center justify-end rounded-t-lg bg-white/10 px-2 py-1 backdrop-blur-sm"
                          style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
                          <Tooltip
                            title={
                              isEditingThisConversation ? 'Switch to View Mode' : 'Edit this Conversation'
                            }>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleEditorMode(convo.conversationId, convo.documentId)}
                              data-testid={`toggle-editor-${convo.conversationId}`}>
                              {isEditingThisConversation ? (
                                <VisibilityIcon fontSize="small" />
                              ) : (
                                <EditIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                          {/* Keep MoreVertIcon for document actions */}
                          <IconButton
                            size="small"
                            onClick={e => handleOptionsClick(e, convo.documentId)}
                            sx={{ color: 'rgba(0, 0, 0, 0.6)', marginLeft: '4px' }}
                            title="Document Options">
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </div>

                        <div className={`p-4 ${isEditingThisConversation ? 'pt-2' : 'pt-4'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 overflow-hidden pr-2 font-editor2 text-black/[.79]">
                              {isEditingThisConversation ? (
                                isActiveEditorLoading ? (
                                  <div className="flex h-20 items-center justify-center">
                                    <Loader />
                                  </div>
                                ) : activeEditorInfo.content ? (
                                  <div
                                    ref={editorWrapperRef}
                                    className="editor-wrapper -mx-4 -my-2"
                                    onClick={e => {
                                      console.log('Clicked inside editor wrapper, stopping propagation.')
                                      e.stopPropagation()
                                    }}>
                                    <EditorComponent
                                      key={activeEditorInfo.documentId}
                                      content={activeEditorInfo.content}
                                      title={''}
                                      onUpdate={debouncedSave}
                                      canEdit={true}
                                      hideFooter={true}
                                      hideTitle={true}
                                      initialFocusConversationId={activeEditorInfo.conversationId}
                                      highlightCharacterName={characterName}
                                    />
                                  </div>
                                ) : (
                                  <Typography color="error">Failed to load content for editing.</Typography>
                                )
                              ) : (
                                <div className="read-only-conversation font-editor2 text-[19px] md:text-[22px]">
                                  {convo.entries.map((entry, entryIndex) => (
                                    <div key={entryIndex} className="dialogue-line mb-1">
                                      <span className="character-name mr-1 font-semibold text-black/[.6]">
                                        {entry.characterName}:
                                      </span>
                                      <TiptapJsonRenderer node={entry.contentNode} className="inline" />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* MoreVertIcon moved to sticky bar */}
                          </div>
                        </div>
                      </Paper>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Menu for Document Options */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleOptionsClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <MenuItem onClick={handleGoToDocument}>Go to Document</MenuItem>
        {/* Add other actions if needed */}
      </Menu>
    </Paper>
  )
}

export default CharacterConversations
