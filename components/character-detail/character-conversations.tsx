'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Paper, Typography, IconButton, Tooltip, Menu, MenuItem } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
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
  const [expandedConversations, setExpandedConversations] = useState<Record<string, boolean>>({})

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
      // Pre-initialize the editor for smoother transitions
      const preInitializeEditor = async () => {
        const firstDocId = conversations[0]?.documentId
        if (firstDocId) {
          const fullDocument = await get(`/documents/${firstDocId}`)
          if (fullDocument) {
            setActiveEditorInfo(prev => ({
              ...prev,
              content: fullDocument.content,
              isLoading: false,
            }))
          }
        }
      }
      preInitializeEditor()
    }
    setExpandedConversations({}) // Reset expansion state on character change
  }, [characterName])

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

  const extractConversationNodes = (fullContent: any, conversationId: string): any => {
    console.log('Extracting conversation nodes for ID:', conversationId)

    // Parse the content if it's a string
    let parsedContent = fullContent
    if (typeof fullContent === 'string') {
      try {
        parsedContent = JSON.parse(fullContent)
      } catch (e) {
        console.error('Failed to parse content in extractConversationNodes:', e)
        return {
          type: 'doc',
          content: [],
        }
      }
    }

    // Store paragraph indices that contain our conversation
    const paragraphsWithConversation = new Set<number>()

    // Helper function to check if a node or its children contain the conversation ID
    const hasConversationMark = (node: any): boolean => {
      // Check this node's marks
      if (node.marks?.length) {
        const hasDialogueMark = node.marks.some(
          (mark: any) => mark.type === 'dialogue' && mark.attrs?.conversationId === conversationId,
        )
        if (hasDialogueMark) return true
      }

      // Check child nodes recursively
      if (node.content?.length) {
        return node.content.some((child: any) => hasConversationMark(child))
      }

      return false
    }

    // Check top-level paragraphs for conversation marks
    if (parsedContent?.type === 'doc' && Array.isArray(parsedContent.content)) {
      parsedContent.content.forEach((paragraph: any, index: number) => {
        if (hasConversationMark(paragraph)) {
          paragraphsWithConversation.add(index)
          console.log(`Found paragraph ${index} with conversation ID ${conversationId}`)
        }
      })
    }

    // If no paragraphs found, return empty document
    if (paragraphsWithConversation.size === 0) {
      console.log('No paragraphs found containing dialogue nodes for conversationId:', conversationId)
      return {
        type: 'doc',
        content: [],
      }
    }

    // Get min and max paragraph indices to extract the full section
    const paragraphIndices = Array.from(paragraphsWithConversation).sort((a, b) => a - b)
    const minParagraphIndex = paragraphIndices[0]
    const maxParagraphIndex = paragraphIndices[paragraphIndices.length - 1]

    console.log(`Extracting paragraphs from ${minParagraphIndex} to ${maxParagraphIndex}`)

    // Extract ALL paragraphs in the range, including those without conversation marks
    const extractedParagraphs = parsedContent.content.slice(minParagraphIndex, maxParagraphIndex + 1)

    console.log(`Extracted ${extractedParagraphs.length} paragraphs`)

    return {
      type: 'doc',
      content: extractedParagraphs,
    }
  }

  const handleToggleEditorMode = async (conversationId: string, documentId: string) => {
    const key = `${conversationId}-${documentId}`
    const currentMode = editorModeMap[key] || 'view'
    const isCurrentlyEditingThis = currentMode === 'edit'

    if (isCurrentlyEditingThis) {
      console.log(`Switching ${key} from edit to view.`)
      setEditorModeMap(prevMap => ({ ...prevMap, [key]: 'view' }))
      setActiveEditorInfo({ conversationId: null, documentId: null, content: null, isLoading: false })
      return
    }

    console.log(`Switching ${key} from view to edit.`)
    if (
      activeEditorInfo.conversationId &&
      activeEditorInfo.documentId &&
      `${activeEditorInfo.conversationId}-${activeEditorInfo.documentId}` !== key
    ) {
      const prevKey = `${activeEditorInfo.conversationId}-${activeEditorInfo.documentId}`
      console.log(`Closing previously active editor: ${prevKey}`)
      setEditorModeMap(prevMap => ({ ...prevMap, [prevKey]: 'view' }))
    }

    setActiveEditorInfo({ conversationId, documentId, content: null, isLoading: true })
    setEditorModeMap(prevMap => ({ ...prevMap, [key]: 'edit' }))

    // Ensure conversation is expanded when entering edit mode
    if (!expandedConversations[key]) {
      handleToggleExpand(key)
    }

    try {
      const fullDocument = await get(`/documents/${documentId}`)
      if (fullDocument) {
        const filteredContent = extractConversationNodes(fullDocument.content, conversationId)
        console.log('Extracted conversation nodes:', filteredContent) // Log the extracted content
        setActiveEditorInfo(prev => ({
          ...prev,
          content: filteredContent,
          isLoading: false,
        }))
      } else {
        console.error('Failed to fetch document content for editing.')
        setActiveEditorInfo(prev => ({ ...prev, isLoading: false }))
      }
    } catch (error) {
      console.error('Error fetching document for editing:', error)
      setActiveEditorInfo(prev => ({ ...prev, isLoading: false }))
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
        const docId = activeEditorInfo.documentId!
        const convoId = activeEditorInfo.conversationId!
        const savedContent = updatedData.content // Content that was just saved

        // Fetch the full document to merge the edited section
        const fullDocument = await get(`/documents/${docId}`)
        if (!fullDocument) {
          console.error('Failed to fetch full document for merging edits.')
          return
        }

        // Merge the edited section back into the full document
        const mergedContent = mergeEditedSection(fullDocument.content, savedContent, convoId)

        await patch(`/documents/${docId}`, {
          content: JSON.stringify(mergedContent),
          lastUpdated: Date.now(),
        })
        console.log(`Document ${docId} saved successfully.`)

        // Update local state with the merged content
        setConversations(prevConversations => {
          const updatedGroups = extractConversationsForCharacter(
            mergedContent,
            characterName,
            fullDocument.title || 'Untitled Document',
            docId,
          )
          return prevConversations.map(convo => {
            if (convo.conversationId === convoId && convo.documentId === docId) {
              return {
                ...convo,
                entries: updatedGroups.find(g => g.conversationId === convoId)?.entries || [],
                lastUpdated: Date.now(),
              }
            }
            return convo
          })
        })
      } catch (error) {
        console.error('Error saving document:', error)
      }
    },
    [patch, activeEditorInfo.documentId, activeEditorInfo.conversationId, characterName, get],
  )

  const mergeEditedSection = (fullContent: any, editedSection: any, conversationId: string): any => {
    // Parse the contents if they're strings
    let parsedFullContent = fullContent
    let parsedEditedSection = editedSection

    if (typeof fullContent === 'string') {
      try {
        parsedFullContent = JSON.parse(fullContent)
      } catch (e) {
        console.error('Failed to parse full content in mergeEditedSection:', e)
        return fullContent
      }
    }

    if (typeof editedSection === 'string') {
      try {
        parsedEditedSection = JSON.parse(editedSection)
      } catch (e) {
        console.error('Failed to parse edited section in mergeEditedSection:', e)
        return parsedFullContent
      }
    }

    // Helper function to check if a node or its children contain the conversation ID
    const hasConversationMark = (node: any): boolean => {
      // Check this node's marks
      if (node.marks?.length) {
        const hasDialogueMark = node.marks.some(
          (mark: any) => mark.type === 'dialogue' && mark.attrs?.conversationId === conversationId,
        )
        if (hasDialogueMark) return true
      }

      // Check child nodes recursively
      if (node.content?.length) {
        return node.content.some((child: any) => hasConversationMark(child))
      }

      return false
    }

    // Find paragraphs with conversation nodes in the full document
    const paragraphsWithConversation = new Set<number>()

    if (parsedFullContent?.type === 'doc' && Array.isArray(parsedFullContent.content)) {
      parsedFullContent.content.forEach((paragraph: any, index: number) => {
        if (hasConversationMark(paragraph)) {
          paragraphsWithConversation.add(index)
        }
      })
    }

    // If no paragraphs found, return original content unchanged
    if (paragraphsWithConversation.size === 0) {
      console.warn('No paragraphs found to merge for conversationId:', conversationId)
      return parsedFullContent
    }

    // Determine the range of paragraphs to replace
    const paragraphIndices = Array.from(paragraphsWithConversation).sort((a, b) => a - b)
    const minParagraphIndex = paragraphIndices[0]
    const maxParagraphIndex = paragraphIndices[paragraphIndices.length - 1]

    console.log(`Merging edited content into paragraphs ${minParagraphIndex} to ${maxParagraphIndex}`)

    // Create merged content by replacing the section
    const mergedContent = {
      ...parsedFullContent,
      content: [
        ...parsedFullContent.content.slice(0, minParagraphIndex),
        ...(parsedEditedSection.content || []),
        ...parsedFullContent.content.slice(maxParagraphIndex + 1),
      ],
    }

    return mergedContent
  }

  // Handler to toggle conversation expansion
  const handleToggleExpand = (key: string) => {
    setExpandedConversations(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  // --- Rendering Logic --- //

  // Log state just before rendering
  console.log(
    'Rendering CharacterConversations. Active Editor:',
    activeEditorInfo.conversationId,
    'Editor Mode Map:',
    editorModeMap,
  )

  const renderConversationEntries = (entries: DialogueEntry[]) => (
    <div className="read-only-conversation font-editor2 text-[19px] md:text-[22px]">
      {entries.map((entry, entryIndex) => (
        <div key={entryIndex} className="dialogue-line mb-1">
          <span className="character-name mr-1 font-semibold text-black/[.6]">{entry.characterName}:</span>
          <TiptapJsonRenderer node={entry.contentNode} className="inline" />
        </div>
      ))}
    </div>
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
                    const key = `${convo.conversationId}-${convo.documentId}`
                    const currentMode = editorModeMap[key] || 'view'
                    const isEditingThisConversation =
                      currentMode === 'edit' &&
                      activeEditorInfo.conversationId === convo.conversationId &&
                      activeEditorInfo.documentId === convo.documentId
                    const isActiveEditorLoading =
                      activeEditorInfo.isLoading &&
                      activeEditorInfo.conversationId === convo.conversationId &&
                      activeEditorInfo.documentId === convo.documentId

                    debugLog(
                      `Rendering convo ${convo.conversationId}: mode = ${currentMode}, isLoading = ${isActiveEditorLoading}`,
                    )

                    return (
                      <Paper
                        key={convo.conversationId}
                        elevation={0}
                        className={`overflow-visible rounded-lg transition-all hover:bg-opacity-20 ${
                          isEditingThisConversation
                            ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent'
                            : ''
                        }`}
                        sx={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.15)' },
                          position: 'relative',
                        }}>
                        <div
                          className="sticky top-0 z-10 flex cursor-pointer items-center justify-between rounded-t-lg bg-white/10 px-2 py-1 backdrop-blur-sm"
                          style={{ background: 'rgba(255, 255, 255, 0.08)' }}
                          onClick={() => handleToggleExpand(key)}>
                          <IconButton size="small" sx={{ visibility: 'hidden' }}>
                            <ExpandMoreIcon fontSize="small" />
                          </IconButton>
                          <div className="flex items-center">
                            <Tooltip
                              title={
                                isEditingThisConversation ? 'Switch to View Mode' : 'Edit this Conversation'
                              }
                              sx={{ color: 'rgba(0, 0, 0, 0.6)', marginLeft: '4px' }}>
                              <IconButton
                                size="small"
                                onClick={e => {
                                  e.stopPropagation()
                                  handleToggleEditorMode(convo.conversationId, convo.documentId)
                                }}
                                data-testid={`toggle-editor-${convo.conversationId}`}>
                                {isEditingThisConversation ? (
                                  <VisibilityIcon fontSize="small" />
                                ) : (
                                  <EditIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            <IconButton
                              size="small"
                              onClick={e => handleOptionsClick(e, convo.documentId)}
                              sx={{ color: 'rgba(0, 0, 0, 0.6)', marginLeft: '4px' }}
                              title="Document Options">
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              sx={{ color: 'rgba(0, 0, 0, 0.6)', marginLeft: '4px' }}
                              title={expandedConversations[key] ? 'Collapse' : 'Expand'}>
                              {expandedConversations[key] ? (
                                <ExpandLessIcon fontSize="small" />
                              ) : (
                                <ExpandMoreIcon fontSize="small" />
                              )}
                            </IconButton>
                          </div>
                        </div>

                        <div
                          style={{
                            maxHeight: expandedConversations[key] ? '1000px' : '0px',
                            overflow: 'hidden',
                            transition: 'max-height 0.5s ease-in-out, padding 0.5s ease-in-out',
                            paddingTop: expandedConversations[key] ? '1rem' : '0',
                            paddingBottom: expandedConversations[key] ? '1rem' : '0',
                            paddingLeft: '1rem',
                            paddingRight: '1rem',
                          }}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1 overflow-hidden pr-2 font-editor2 text-black/[.79]">
                              {isEditingThisConversation ? (
                                activeEditorInfo.content ? (
                                  <div
                                    ref={editorWrapperRef}
                                    className="editor-wrapper -mx-4 -my-2"
                                    style={{
                                      transition: 'opacity 0.3s ease-in-out, height 0.3s ease-in-out',
                                      opacity: 1,
                                    }}
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
                                      filteredContent={activeEditorInfo.content}
                                    />
                                  </div>
                                ) : (
                                  renderConversationEntries(convo.entries)
                                )
                              ) : (
                                renderConversationEntries(convo.entries)
                              )}
                            </div>
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
