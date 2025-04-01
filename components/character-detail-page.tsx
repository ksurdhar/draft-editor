'use client'

import { useState, useEffect } from 'react'
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

// Dialogue type definition
interface DialogueEntry {
  _id?: string
  characterId: string
  characterName: string
  documentId?: string
  documentTitle?: string
  content: string
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

// Keep the old function for reference or potential future use, renamed
/*
const extractIndividualDialogueLinesForCharacter = (
  documentContent: any,
  characterName: string,
  _documentTitle: string, // Prefix unused parameter
  _documentId: string, // Prefix unused parameter
): DialogueEntry[] => {
    // ... existing implementation of extractDialogueForCharacter ...
    // Note: The original _id generation might need adjustment if reused
    const dialogueEntries: DialogueEntry[] = [] // Adjust type if needed

   const processNode = (node: any / *, contextBefore = '', contextAfter = '' * /) => { // Comment out unused params
      if (node.type === 'text' && node.marks) {
        const dialogueMark = node.marks.find(
          (mark: any) => mark.type === 'dialogue' && mark.attrs?.character === characterName,
        )

        if (dialogueMark && node.text) {
         // Original push logic - adjust if this function is ever reused
        dialogueEntries.push({
         characterId: dialogueMark.attrs.character,
         characterName: dialogueMark.attrs.character,
         content: node.text,
         lastUpdated: Date.now(),
        })
        }
      }
       // ... rest of recursive processing ...
       if (node.content && Array.isArray(node.content)) {
       node.content.forEach((childNode: any / *, index: number * /) => { // Comment out unused index
            // Simplified context (less relevant for conversations)
            processNode(childNode)
        })
       }
    }
     if (documentContent && documentContent.type === 'doc') {
       processNode(documentContent)
     }
    return dialogueEntries
}
*/

// New function to extract conversations
const extractConversationsForCharacter = (
  documentContent: any,
  targetCharacterName: string,
  documentTitle: string,
  documentId: string,
): ConversationGroup[] => {
  const conversationsMap: Record<string, ConversationGroup> = {}
  let characterParticipates: Record<string, boolean> = {}

  const processNode = (node: any) => {
    if (node.type === 'text' && node.marks) {
      node.marks.forEach((mark: any) => {
        if (mark.type === 'dialogue' && mark.attrs?.conversationId && mark.attrs?.character && node.text) {
          const { conversationId, character } = mark.attrs
          const content = node.text

          // Ensure conversation group exists
          if (!conversationsMap[conversationId]) {
            conversationsMap[conversationId] = {
              conversationId,
              documentId,
              documentTitle,
              entries: [],
              // We might want to get a more accurate timestamp later
              lastUpdated: Date.now(),
            }
            characterParticipates[conversationId] = false
          }

          // Add the dialogue entry
          conversationsMap[conversationId].entries.push({
            characterId: character,
            characterName: character, // Assuming name is same as ID for now
            content: content,
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
  if (documentContent && documentContent.type === 'doc') {
    processNode(documentContent)
  }

  // Filter conversations to include only those where the target character participates
  const participatingConversations = Object.values(conversationsMap).filter(
    group => characterParticipates[group.conversationId],
  )

  // Optional: Sort entries within each conversation based on their original order?
  // This requires more complex tracking during parsing (e.g., node position).
  // For now, they will be in the order they were found during traversal.

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
  // Expanded state now keys on conversationId - Currently unused
  // const [expandedConversations, setExpandedConversations] = useState<Record<string, boolean>>({})
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  // Store documentId associated with the menu
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)

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
          if (document && document.content) {
            // Extract conversation groups for this character from the document
            const groupsFromDoc = extractConversationsForCharacter(
              document.content,
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
      debugLog('allConversationGroups', allConversationGroups)

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

  // Toggle conversation expansion - Currently unused in JSX but kept for potential future use

  // const toggleConversationExpansion = useCallback((conversationId: string, event: React.MouseEvent) => {
  //   event.stopPropagation() // Prevent navigation if needed
  //   setExpandedConversations(prev => ({
  //     ...prev,
  //     [conversationId]: !prev[conversationId],
  //   }))
  // }, [])
  const toggleConversationExpansion = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent navigation if needed
    // setExpandedConversations(prev => ({
    //   ...prev,
    //   [conversationId]: !prev[conversationId],
    // }))
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
                            return (
                              <Paper
                                key={convo.conversationId} // Use conversationId as key
                                elevation={0}
                                className="overflow-hidden rounded-lg transition-all hover:bg-opacity-20"
                                sx={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                  },
                                }}>
                                <div className={`p-4 ${isExpanded ? 'pb-4' : 'pb-2'}`}>
                                  {' '}
                                  {/* Adjust padding */}
                                  <div className="flex items-start justify-between">
                                    {' '}
                                    {/* Use items-start */}
                                    {/* Conversation Entries */}
                                    <div className="flex-1 overflow-hidden pr-2">
                                      {/* Optional: Display Conversation ID subtly */}
                                      {/* <Typography variant="caption" className="mb-1 block text-black/[.4]">
                                        ID: {convo.conversationId}
                                      </Typography> */}

                                      {/* Render all entries in the conversation */}
                                      {convo.entries.map((entry, entryIndex) => (
                                        <Typography
                                          key={entryIndex}
                                          variant="body2" // Use body2 for dialogue lines
                                          className={`whitespace-pre-line text-black/[.8] ${
                                            entry.characterName === character.name ? 'font-semibold' : '' // Highlight speaker
                                          } mb-1`}>
                                          <span className="text-black/[.6]">{entry.characterName}: </span>
                                          {entry.content}
                                        </Typography>
                                      ))}
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
