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
  // State for inline editing
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null)
  const [editingDocumentContent, setEditingDocumentContent] = useState<any>(null) // Store full document content for editor
  const [isLoadingDocumentForEdit, setIsLoadingDocumentForEdit] = useState(false)
  // Expanded state now keys on conversationId - Currently unused
  // const [expandedConversations, setExpandedConversations] = useState<Record<string, boolean>>({})
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  // Store documentId associated with the menu
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)
  const editorWrapperRef = useRef<HTMLDivElement>(null) // Add ref for the editor wrapper

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

  // Effect to handle clicking outside the inline editor
  useEffect(() => {
    // Function to check if click is outside the editor wrapper
    const handleClickOutside = (event: MouseEvent) => {
      if (editorWrapperRef.current && !editorWrapperRef.current.contains(event.target as Node)) {
        // Clicked outside: Exit editing mode without saving
        console.log('Clicked outside editor, exiting edit mode.') // Optional: for debugging
        setEditingConversationId(null)
        setEditingDocumentId(null)
        setEditingDocumentContent(null)
        // Note: This discards any unsaved changes in the inline editor.
      }
    }

    // Add listener only when editing
    if (editingConversationId) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    // Cleanup listener when component unmounts or editing stops
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingConversationId]) // Re-run this effect when editingConversationId changes

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
    setAnchorEl(event.currentTarget)
    setActiveDocumentId(documentId) // Store the documentId
  }

  const handleOptionsClose = () => {
    setAnchorEl(null)
    setActiveDocumentId(null)
  }

  const handleGoToDocument = () => {
    if (activeDocumentId) {
      navigateTo(`/documents/${activeDocumentId}`)
    }
    handleOptionsClose()
  }

  // Function to handle starting the edit mode for a conversation
  const handleEditConversation = async (conversationId: string, documentId: string) => {
    // Prevent starting a new edit if one is already in progress
    if (editingConversationId || isLoadingDocumentForEdit) return

    setEditingConversationId(conversationId)
    setEditingDocumentId(documentId)
    setIsLoadingDocumentForEdit(true)
    setEditingDocumentContent(null) // Clear previous content

    try {
      // Fetch the full document content
      const fullDocument = await get(`/documents/${documentId}`)
      if (fullDocument) {
        setEditingDocumentContent(fullDocument.content) // Store the full content
      } else {
        console.error('Failed to fetch document content for editing.')
        // Reset state if fetch fails
        setEditingConversationId(null)
        setEditingDocumentId(null)
      }
    } catch (error) {
      console.error('Error fetching document for editing:', error)
      // Reset state on error
      setEditingConversationId(null)
      setEditingDocumentId(null)
    } finally {
      setIsLoadingDocumentForEdit(false)
    }
  }

  // Function to handle saving the edited document content
  const handleSaveEditedDocument = async (updatedData: Partial<DocumentData>) => {
    if (!editingDocumentId) {
      console.error('Cannot save: No document ID is being edited.')
      return
    }

    setIsLoadingDocumentForEdit(true) // Indicate saving is in progress
    try {
      await patch(`/documents/${editingDocumentId}`, {
        content: updatedData.content, // Assuming content is the main field to update
        lastUpdated: Date.now(),
        // Include title update if the editor modifies it, otherwise omit
        // title: updatedData.title
      })

      // IMPORTANT: Reload conversations to show the updated content immediately
      if (character?.name) {
        await loadConversations(character.name)
      }
    } catch (error) {
      console.error('Error saving document:', error)
      // Maybe show an error message to the user
    } finally {
      // Exit editing mode regardless of success or failure
      setEditingConversationId(null)
      setEditingDocumentId(null)
      setEditingDocumentContent(null)
      setIsLoadingDocumentForEdit(false) // Finish loading/saving state
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
                            // Iterate through conversations
                            // const isExpanded = expandedConversations[convo.conversationId] // Use conversationId for expansion - Currently unused
                            const isExpanded = false // Default to false since expansion is disabled
                            const isEditingThisConversation = editingConversationId === convo.conversationId

                            // DEBUG LOG
                            debugLog(
                              `Rendering convo ${convo.conversationId}: isEditing = ${isEditingThisConversation}`,
                            )

                            return (
                              <Paper
                                key={convo.conversationId} // Use conversationId as key
                                elevation={0}
                                className={`overflow-hidden rounded-lg transition-all hover:bg-opacity-20 ${isEditingThisConversation ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent' : ''}`}
                                sx={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                  },
                                }}
                                // Add double-click handler to initiate editing
                                onDoubleClick={() =>
                                  handleEditConversation(convo.conversationId, convo.documentId)
                                }>
                                <div className={`p-4 ${isExpanded ? 'pb-4' : 'pb-2'}`}>
                                  <div className="flex items-start justify-between">
                                    {/* Conversation Entries / Editor Container */}
                                    <div className="flex-1 overflow-hidden pr-2 font-editor2 text-black/[.79]">
                                      {' '}
                                      {/* Wrapper for content/editor */}
                                      {/* Render editor if editing, otherwise render conversation */}
                                      {isEditingThisConversation ? (
                                        isLoadingDocumentForEdit ? (
                                          <div className="flex h-20 items-center justify-center">
                                            <Loader />
                                          </div>
                                        ) : editingDocumentContent ? (
                                          // Render the actual EditorComponent
                                          // Attach the ref to this wrapper div
                                          <div ref={editorWrapperRef} className="editor-wrapper -mx-4 -my-2">
                                            {' '}
                                            {/* Attach ref here */}
                                            <EditorComponent
                                              key={editingDocumentId}
                                              content={editingDocumentContent}
                                              title={''}
                                              onUpdate={handleSaveEditedDocument}
                                              canEdit={true}
                                              hideFooter={true}
                                              hideTitle={true}
                                              initialFocusConversationId={editingConversationId}
                                              highlightCharacterName={character?.name}
                                            />
                                          </div>
                                        ) : (
                                          <Typography color="error">
                                            Failed to load content for editing.
                                          </Typography>
                                        )
                                      ) : (
                                        // Render read-only conversation entries
                                        <div className="read-only-conversation font-editor2 text-[19px] md:text-[22px]">
                                          {convo.entries.map((entry, entryIndex) => (
                                            <div key={entryIndex} className="dialogue-line mb-1">
                                              <span className="character-name mr-1 font-semibold text-black/[.6]">
                                                {entry.characterName}:
                                              </span>
                                              {/* Ensure inline rendering flows correctly */}
                                              <TiptapJsonRenderer
                                                node={entry.contentNode}
                                                className="inline"
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* Controls */}
                                    <div className="ml-3 flex shrink-0 flex-col items-end space-y-1">
                                      {' '}
                                      {/* Flex column for controls */}
                                      {/* Keep MoreVertIcon for document actions */}
                                      <IconButton
                                        size="small"
                                        onClick={e => handleOptionsClick(e, convo.documentId)} // Pass documentId
                                        sx={{ color: 'rgba(0, 0, 0, 0.6)' }}
                                        title="Go to Document">
                                        <MoreVertIcon fontSize="small" />
                                      </IconButton>
                                      {/* Add Expand/Collapse - maybe not needed per conversation? */}
                                      {/* If needed, adapt toggleConversationExpansion */}
                                      {/* Example of how expansion toggle could be added back */}
                                      {/*
                                      <IconButton
                                        size="small"
                                        onClick={e => toggleConversationExpansion(convo.conversationId, e)} // Need to uncomment toggle function and state
                                        sx={{ color: 'rgba(0, 0, 0, 0.6)' }}>
                                         {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />} // Need to import icons
                                      </IconButton>
                                      */}
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
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
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
