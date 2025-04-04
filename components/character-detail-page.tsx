'use client'

import { useState, useEffect, useRef } from 'react'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import { Paper, Typography, Chip, Box, IconButton, Tooltip, Button, Menu, MenuItem } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import CharacterModal from '@components/character-modal'
import { useLocation } from 'wouter'
import { useNavigation } from '@components/providers'
import { debugLog } from '@lib/debug-logger'
import TiptapJsonRenderer from '@components/tiptap-json-renderer'
import EditorComponent from '@components/editor'
import { DocumentData } from '@typez/globals'
import VisibilityIcon from '@mui/icons-material/Visibility' // Keep View icon

// Character type definition from character-modal.tsx
interface CharacterData {
  _id?: string
  name: string
  motivation: string
  description: string
  traits: string[]
  // Extended properties for our component
  relationships?: Array<{
    characterId: string
    relationshipType: string
    description: string
  }>
  userId?: string
  documentIds?: string[]
  lastUpdated?: number
  isArchived?: boolean
}

// Basic type definitions for Tiptap JSON structure (reuse or import from renderer)
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

// Dialogue type definition - Update content type
interface DialogueEntry {
  _id?: string
  characterId: string
  characterName: string
  documentId?: string
  documentTitle?: string
  // content: string // Changed from string to TiptapNode
  contentNode: TiptapNode // Store the specific Tiptap node (usually 'text' type)
  context?: {
    before?: string
    after?: string
  }
  location?: {
    paragraphIndex?: number
    paragraphHash?: string
  }
  sceneInfo?: {
    sceneId?: string
    sceneName?: string
  }
  lastUpdated?: number
  isValid?: boolean
}

// New interface for grouping dialogues by conversation
interface ConversationGroup {
  conversationId: string
  documentId: string
  documentTitle: string
  entries: DialogueEntry[] // All entries in this conversation within this document
  lastUpdated?: number // Timestamp of the document or latest entry? TBD
  // Optional: Add position info if needed for sorting later
}

// New function to extract conversations
const extractConversationsForCharacter = (
  documentContent: any, // Keep as any for now, assuming it's parsed Tiptap JSON
  targetCharacterName: string,
  documentTitle: string,
  documentId: string,
): ConversationGroup[] => {
  const conversationsMap: Record<string, ConversationGroup> = {}
  let characterParticipates: Record<string, boolean> = {}

  // Cast node to TiptapNode for better type safety inside the function
  const processNode = (node: TiptapNode) => {
    if (node.type === 'text' && node.marks) {
      node.marks.forEach((mark: TiptapMark) => {
        if (mark.type === 'dialogue' && mark.attrs?.conversationId && mark.attrs?.character && node.text) {
          const { conversationId, character } = mark.attrs
          // const content = node.text; // No longer needed

          // Ensure conversation group exists
          if (!conversationsMap[conversationId]) {
            conversationsMap[conversationId] = {
              conversationId,
              documentId,
              documentTitle,
              entries: [],
              lastUpdated: Date.now(), // Consider a more accurate timestamp
            }
            characterParticipates[conversationId] = false
          }

          // Add the dialogue entry, now storing the Tiptap node itself
          conversationsMap[conversationId].entries.push({
            characterId: character,
            characterName: character, // Assuming name is same as ID for now
            contentNode: { ...node }, // Store a copy of the text node with its marks
            documentId: documentId, // Add documentId to entry for context
            documentTitle: documentTitle, // Add documentTitle to entry for context
          })

          // Track if the target character is in this conversation
          if (character === targetCharacterName) {
            characterParticipates[conversationId] = true
          }
        }
      })
    }

    // Process child nodes recursively
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(processNode)
    }
  }

  // Start processing from root node
  // Ensure documentContent is the parsed JSON object, not a string
  if (documentContent && typeof documentContent === 'object' && documentContent.type === 'doc') {
    let parsedContent: TiptapNode
    if (typeof documentContent === 'string') {
      try {
        parsedContent = JSON.parse(documentContent)
      } catch (e) {
        console.error('Failed to parse document content in extractConversationsForCharacter:', e)
        return [] // Return empty if parsing fails
      }
    } else {
      parsedContent = documentContent // Assume it's already an object
    }
    processNode(parsedContent)
  } else if (documentContent && typeof documentContent !== 'object') {
    console.warn(
      'extractConversationsForCharacter received non-object document content, attempting parse:',
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

  // Filter conversations to include only those where the target character participates
  const participatingConversations = Object.values(conversationsMap).filter(
    group => characterParticipates[group.conversationId],
  )

  return participatingConversations
}

const CharacterDetailPage = ({
  character,
  isLoading,
  onCharacterChange,
}: {
  character: CharacterData | null
  isLoading?: boolean
  onCharacterChange: (character: CharacterData) => void
}) => {
  const { patch, get } = useAPI()
  const { isLoading: userLoading } = useUser()
  const [, setLocation] = useLocation()
  const { navigateTo } = useNavigation()
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null)
  // Update state to hold ConversationGroup[]
  const [conversations, setConversations] = useState<ConversationGroup[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [initAnimate, setInitAnimate] = useState(false)

  // NEW STATE: Track view/edit mode for each conversation
  const [editorModeMap, setEditorModeMap] = useState<Record<string, 'view' | 'edit'>>({})

  // NEW STATE: Track the single active editor instance details
  const [activeEditorInfo, setActiveEditorInfo] = useState<{
    conversationId: string | null
    documentId: string | null
    content: any // Store full document content for the active editor
    isLoading: boolean
  }>({
    conversationId: null,
    documentId: null,
    content: null,
    isLoading: false,
  })

  const editorWrapperRef = useRef<HTMLDivElement>(null) // Keep ref for click outside

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitAnimate(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Load conversation groups when character changes
  useEffect(() => {
    if (character?.name) {
      // Use name as it's needed for extraction
      loadConversations(character.name)
    }
  }, [character?.name]) // Depend on name

  // Update Click Outside Logic to use activeEditorInfo
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        activeEditorInfo.conversationId && // Only run if an editor is active
        editorWrapperRef.current &&
        !editorWrapperRef.current.contains(event.target as Node)
      ) {
        console.log('Clicked outside active editor, switching back to view mode.')
        // Switch the active editor back to view mode
        setEditorModeMap(prevMap => ({
          ...prevMap,
          [activeEditorInfo.conversationId!]: 'view',
        }))
        // Reset active editor info
        setActiveEditorInfo({
          conversationId: null,
          documentId: null,
          content: null,
          isLoading: false,
        })
      }
    }

    // Add listener only when an editor is active
    if (activeEditorInfo.conversationId) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside) // Ensure cleanup if no editor is active
    }

    // Cleanup listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeEditorInfo.conversationId]) // Depend on the active editor ID

  const loadConversations = async (characterName: string) => {
    try {
      setLoadingConversations(true)

      // Get all documents
      const allDocuments = await get('/documents')

      if (!allDocuments || allDocuments.length === 0) {
        setConversations([])
        return
      }

      const allConversationGroups: ConversationGroup[] = []
      for (const document of allDocuments) {
        try {
          let contentToParse = document.content
          // Ensure content is parsed if it's a string
          if (typeof contentToParse === 'string') {
            try {
              contentToParse = JSON.parse(contentToParse)
            } catch (e) {
              console.error(`Failed to parse content for document ${document._id}:`, e)
              contentToParse = null // Skip this document if content is invalid
            }
          }

          if (contentToParse) {
            // Extract conversation groups for this character from the document
            const groupsFromDoc = extractConversationsForCharacter(
              contentToParse, // Pass the parsed content
              characterName,
              document.title || 'Untitled Document',
              document._id,
            )

            if (groupsFromDoc.length > 0) {
              allConversationGroups.push(...groupsFromDoc)

              // Document ID association logic might need review based on how you want to track 'appears in'
              // This assumes you still want to update based on *any* participation.
              if (character?._id && character.documentIds && !character.documentIds.includes(document._id)) {
                const updatedDocumentIds = [...character.documentIds, document._id]
                // Assuming patch still works and onCharacterChange exists
                await patch(`/characters/${character._id}`, {
                  documentIds: updatedDocumentIds,
                })
                if (character) {
                  // Check character exists before spreading
                  onCharacterChange({
                    ...character,
                    documentIds: updatedDocumentIds,
                  })
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing document ${document._id} for conversations:`, error)
        }
      }

      // Sort conversation groups by document title and then maybe conversationId or position
      allConversationGroups.sort((a, b) => {
        if (a.documentTitle !== b.documentTitle) {
          return (a.documentTitle || '').localeCompare(b.documentTitle || '')
        }
        // Secondary sort (e.g., by conversationId)
        return a.conversationId.localeCompare(b.conversationId)
      })

      setConversations(allConversationGroups)
    } catch (error) {
      console.error('Error loading conversation groups:', error)
      setConversations([])
    } finally {
      setLoadingConversations(false)
    }
  }

  const handleUpdateCharacter = async (characterData: CharacterData) => {
    try {
      if (!characterData._id) {
        console.error('Cannot update character without ID')
        return null
      }

      const updatedCharacter = await patch(`/characters/${characterData._id}`, characterData)
      onCharacterChange(updatedCharacter)
      return updatedCharacter
    } catch (error) {
      console.error('Error updating character:', error)
      return null
    }
  }

  const showSpinner = useSpinner(isLoading || userLoading || loadingConversations) // Add loadingConversations

  const handleOptionsClick = (
    event: React.MouseEvent<HTMLElement>,
    documentId: string, // Pass documentId directly
  ) => {
    event.stopPropagation()
    setEditorModeMap(prevMap => ({
      ...prevMap,
      [activeEditorInfo.conversationId!]: 'view',
    }))
    setActiveEditorInfo({
      conversationId: null,
      documentId,
      content: null,
      isLoading: false,
    })
  }

  const handleOptionsClose = () => {
    setEditorModeMap(prevMap => ({
      ...prevMap,
      [activeEditorInfo.conversationId!]: 'view',
    }))
    setActiveEditorInfo({
      conversationId: null,
      documentId: null,
      content: null,
      isLoading: false,
    })
  }

  const handleGoToDocument = () => {
    if (activeEditorInfo.documentId) {
      navigateTo(`/documents/${activeEditorInfo.documentId}`)
    }
    handleOptionsClose()
  }

  // NEW function to handle toggling editor mode
  const handleToggleEditorMode = async (conversationId: string, documentId: string) => {
    const currentMode = editorModeMap[conversationId] || 'view'
    const isCurrentlyEditingThis = currentMode === 'edit'

    // --- Switching FROM Edit TO View ---
    if (isCurrentlyEditingThis) {
      console.log(`Switching ${conversationId} from edit to view.`)
      // Simply switch mode and clear active editor info
      // NOTE: This currently discards unsaved changes in the editor!
      // Consider adding a confirmation or save prompt later if needed.
      setEditorModeMap(prevMap => ({
        ...prevMap,
        [conversationId]: 'view',
      }))
      setActiveEditorInfo({
        conversationId: null,
        documentId: null,
        content: null,
        isLoading: false,
      })
      return // Done for this case
    }

    // --- Switching FROM View TO Edit ---
    console.log(`Switching ${conversationId} from view to edit.`)

    // If another editor is already active, switch it to view mode first
    if (activeEditorInfo.conversationId && activeEditorInfo.conversationId !== conversationId) {
      console.log(`Closing previously active editor: ${activeEditorInfo.conversationId}`)
      setEditorModeMap(prevMap => ({
        ...prevMap,
        [activeEditorInfo.conversationId!]: 'view',
      }))
    }

    // Set loading state for the new active editor
    setActiveEditorInfo({
      conversationId: conversationId,
      documentId: documentId,
      content: null, // Clear previous content
      isLoading: true,
    })
    // Update the map to reflect the switch to edit mode
    setEditorModeMap(prevMap => ({
      ...prevMap,
      [conversationId]: 'edit',
    }))

    // Fetch document content
    try {
      const fullDocument = await get(`/documents/${documentId}`)
      // Check if we are still trying to edit the same conversation
      // (User might have clicked another toggle quickly)
      // USE FUNCTIONAL UPDATE FORM FOR STATE CHECK AND UPDATE
      setActiveEditorInfo(prev => {
        if (prev.conversationId === conversationId) {
          // Still editing the same one, update content and loading state
          if (fullDocument) {
            return {
              ...prev,
              content: fullDocument.content,
              isLoading: false, // Loading finished
            }
          } else {
            console.error('Failed to fetch document content for editing.')
            // Revert to view mode on fetch failure - handled outside this update
            // We just need to stop loading for this specific one
            return { ...prev, isLoading: false }
          }
        } else {
          // Editor target changed during fetch, just return previous state (the new target)
          console.log('Editor target changed during fetch, aborting content set.')
          return prev
        }
      })

      // Handle reverting to view mode if fetch failed for the *target* conversation
      if (!fullDocument) {
        setEditorModeMap(prevMap => {
          // Only revert if the map still shows this convo as 'edit'
          if (prevMap[conversationId] === 'edit') {
            return { ...prevMap, [conversationId]: 'view' }
          }
          return prevMap // No change needed if it's already 'view' or another convo is active
        })
      }
    } catch (error) {
      console.error('Error fetching document for editing:', error)
      // USE FUNCTIONAL UPDATE FORM FOR STATE CHECK AND REVERT
      setActiveEditorInfo(prev => {
        if (prev.conversationId === conversationId) {
          // Error occurred while trying to load the active editor, stop loading
          return { ...prev, isLoading: false }
        }
        // Error occurred for a different convo, ignore
        return prev
      })
      // Revert to view mode on error only if this is still the target
      setEditorModeMap(prevMap => {
        if (prevMap[conversationId] === 'edit') {
          return { ...prevMap, [conversationId]: 'view' }
        }
        return prevMap
      })
    }
  }

  // UPDATE Save Logic to use activeEditorInfo
  const handleSaveEditedDocument = async (updatedData: Partial<DocumentData>) => {
    if (!activeEditorInfo.documentId) {
      console.error('Cannot save: No active document ID.')
      return
    }
    if (!activeEditorInfo.conversationId) {
      console.error('Cannot save: No active conversation ID.') // Should not happen if documentId exists
      return
    }

    setActiveEditorInfo(prev => ({ ...prev, isLoading: true })) // Indicate saving

    try {
      await patch(`/documents/${activeEditorInfo.documentId}`, {
        content: updatedData.content,
        lastUpdated: Date.now(),
      })

      if (character?.name) {
        await loadConversations(character.name) // Reload to show updated content
      }

      // Switch back to view mode after successful save
      const savedConversationId = activeEditorInfo.conversationId
      setEditorModeMap(prevMap => ({
        ...prevMap,
        [savedConversationId]: 'view',
      }))
      setActiveEditorInfo({ conversationId: null, documentId: null, content: null, isLoading: false })
    } catch (error) {
      console.error('Error saving document:', error)
      // Keep editor open on error? Or close? For now, keep open and reset loading state.
      setActiveEditorInfo(prev => ({ ...prev, isLoading: false }))
    } finally {
      // Ensure loading state is reset even if save fails but we stay in edit mode
      // setActiveEditorInfo(prev => ({ ...prev, isLoading: false }))
      // ^^^ Already handled in catch and success path correctly
    }
  }

  if (showSpinner) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  if (!character) {
    return (
      <Layout>
        <div className="flex h-full w-full items-center justify-center">
          <Typography variant="h6">Character not found</Typography>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="gradient-editor fixed left-0 top-0 z-[-1] h-screen w-screen" />
      <div
        className={`gradient fixed left-0 top-0 z-[-1] h-screen w-screen transition-opacity duration-[3000ms] ease-in-out ${
          initAnimate ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] flex-col justify-center pb-5">
        {/* Back Button */}
        <div className="mx-auto w-11/12 max-w-[1200px] px-4">
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => setLocation('/characters')}
            variant="text"
            className="mb-4 self-start"
            sx={{
              color: 'rgba(0, 0, 0, 0.87)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}>
            Back to Characters
          </Button>
        </div>

        {/* Two Column Layout */}
        <div className="mx-auto grid w-11/12 max-w-[1200px] flex-1 grid-cols-1 gap-6 overflow-hidden px-4 md:grid-cols-3">
          {/* Left Column - Character Details */}
          <div className="md:col-span-1">
            <Paper
              elevation={0}
              className="sticky top-[54px] overflow-hidden rounded-lg p-5"
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                height: 'fit-content',
                maxHeight: 'calc(100vh - 120px)',
                overflowY: 'auto',
              }}>
              <div className="mb-4 flex items-center justify-between">
                <Typography variant="h4" className="font-bold">
                  {character.name}
                </Typography>
                <Tooltip title="Edit Character">
                  <IconButton onClick={() => setEditingCharacter(character)} size="small">
                    <EditIcon />
                  </IconButton>
                </Tooltip>
              </div>

              <Typography variant="subtitle1" className="mb-4 text-black/[.7]">
                <span className="font-semibold">Motivation:</span>{' '}
                {character.motivation || 'No motivation specified'}
              </Typography>

              <Typography variant="body1" className="mb-5 text-black/[.8]">
                {character.description || 'No description available'}
              </Typography>

              {character.traits && character.traits.length > 0 && (
                <Box className="mb-5">
                  <Typography variant="subtitle2" className="mb-2 font-semibold">
                    Traits:
                  </Typography>
                  <div className="flex flex-wrap gap-1">
                    {character.traits.map((trait, index) => (
                      <Chip
                        key={index}
                        label={trait}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                      />
                    ))}
                  </div>
                </Box>
              )}

              {/* Document links */}
              {character.documentIds && character.documentIds.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" className="mb-2 font-semibold">
                    Appears in:
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {character.documentIds.map((docId, index) => (
                      <Chip
                        key={index}
                        label={`Document ${index + 1}`}
                        size="small"
                        color="secondary"
                        variant="outlined"
                        onClick={() => navigateTo(`/documents/${docId}`)}
                        sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                      />
                    ))}
                  </div>
                </Box>
              )}
            </Paper>
          </div>

          {/* Right Column - Conversations */}
          <div className="md:col-span-2">
            <Paper
              elevation={0}
              className="mb-6 overflow-hidden rounded-lg p-6"
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                height: 'calc(100vh - 120px)',
                display: 'flex',
                flexDirection: 'column',
              }}>
              <Typography variant="h5" className="mb-4 font-semibold">
                Character Conversations
              </Typography>

              {/* Conversation Groups */}
              <div className="flex-1 overflow-y-auto pr-2">
                {loadingConversations ? ( // Use new loading state
                  <div className="flex h-full items-center justify-center">
                    <Loader />
                  </div>
                ) : conversations.length === 0 ? ( // Use new state name
                  <div className="flex h-full items-center justify-center">
                    <Typography variant="body2" className="text-center text-black/[.6]">
                      No conversations found involving this character.
                    </Typography>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Group conversations by document */}
                    {Object.entries(
                      conversations.reduce(
                        // Use new state name
                        (groups, convo) => {
                          const key = convo.documentTitle || 'Unknown Document'
                          if (!groups[key]) groups[key] = []
                          groups[key].push(convo)
                          return groups
                        },
                        {} as Record<string, ConversationGroup[]>, // Use new type
                      ),
                    ).map(([documentTitle, convosInDoc]) => (
                      <div key={documentTitle} className="mb-6">
                        <Typography
                          variant="subtitle1"
                          className="mb-2 border-b border-white/20 pb-2 font-medium">
                          {documentTitle}
                        </Typography>
                        <div className="space-y-3">
                          {convosInDoc.map((convo: ConversationGroup) => {
                            const currentMode = editorModeMap[convo.conversationId] || 'view'
                            const isEditingThisConversation = currentMode === 'edit'
                            const isActiveEditorLoading =
                              activeEditorInfo.isLoading &&
                              activeEditorInfo.conversationId === convo.conversationId

                            // DEBUG LOG remains useful
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
                                  '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                  },
                                  position: 'relative', // Needed for sticky positioning context
                                }}>
                                {/* Sticky Control Bar */}
                                <div
                                  className="sticky top-0 z-10 flex items-center justify-end rounded-t-lg bg-white/10 px-2 py-1 backdrop-blur-sm"
                                  style={{ background: 'rgba(255, 255, 255, 0.08)' }} // Slightly different background for visibility
                                >
                                  <Tooltip
                                    title={
                                      isEditingThisConversation
                                        ? 'Switch to View Mode'
                                        : 'Edit this Conversation'
                                    }>
                                    <IconButton
                                      size="small"
                                      onClick={() =>
                                        handleToggleEditorMode(convo.conversationId, convo.documentId)
                                      }>
                                      {isEditingThisConversation ? (
                                        <VisibilityIcon fontSize="small" />
                                      ) : (
                                        <EditIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                  </Tooltip>
                                </div>

                                <div className={`p-4 ${isEditingThisConversation ? 'pt-2' : 'pt-4'}`}>
                                  {' '}
                                  {/* Adjust padding based on bar */}
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 overflow-hidden pr-2 font-editor2 text-black/[.79]">
                                      {isEditingThisConversation ? (
                                        isActiveEditorLoading ? (
                                          <div className="flex h-20 items-center justify-center">
                                            <Loader />
                                          </div>
                                        ) : activeEditorInfo.content ? (
                                          <div ref={editorWrapperRef} className="editor-wrapper -mx-4 -my-2">
                                            <EditorComponent
                                              key={activeEditorInfo.documentId} // Use active document ID
                                              content={activeEditorInfo.content} // Use active content
                                              title={''}
                                              onUpdate={handleSaveEditedDocument}
                                              canEdit={true}
                                              hideFooter={true}
                                              hideTitle={true}
                                              initialFocusConversationId={activeEditorInfo.conversationId} // Use active convo ID
                                              highlightCharacterName={character?.name}
                                            />
                                          </div>
                                        ) : (
                                          <Typography color="error">
                                            Failed to load content for editing.
                                          </Typography>
                                        )
                                      ) : (
                                        // Render read-only view
                                        <div className="read-only-conversation font-editor2 text-[19px] md:text-[22px]">
                                          {convo.entries.map((entry, entryIndex) => (
                                            <div key={entryIndex} className="dialogue-line mb-1">
                                              <span className="character-name mr-1 font-semibold text-black/[.6]">
                                                {entry.characterName}:
                                              </span>
                                              <TiptapJsonRenderer
                                                node={entry.contentNode}
                                                className="inline"
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* Controls (Keep MoreVertIcon) */}
                                    <div className="ml-3 flex shrink-0 flex-col items-end space-y-1">
                                      <IconButton
                                        size="small"
                                        onClick={e => handleOptionsClick(e, convo.documentId)}
                                        sx={{ color: 'rgba(0, 0, 0, 0.6)' }}
                                        title="Go to Document">
                                        <MoreVertIcon fontSize="small" />
                                      </IconButton>
                                      {/* Remove Expansion Toggle if it exists */}
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
            </Paper>
          </div>
        </div>
      </div>

      <CharacterModal
        open={!!editingCharacter}
        onClose={() => setEditingCharacter(null)}
        onConfirm={handleUpdateCharacter}
        initialData={editingCharacter}
      />

      {/* Menu for Options - Now triggers Go To Document */}
      <Menu
        anchorEl={null}
        open={false}
        onClose={handleOptionsClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}>
        <MenuItem onClick={handleGoToDocument}>Go to Document</MenuItem>
        {/* Add other actions if needed */}
      </Menu>
    </Layout>
  )
}

export default CharacterDetailPage
