'use client'

import { useState, useEffect, useCallback } from 'react'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import { Paper, Typography, Chip, Box, IconButton, Tooltip, Button } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
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

// Extract dialogue for a character from a document's Tiptap JSON content
const extractDialogueForCharacter = (
  documentContent: any,
  characterName: string,
  documentTitle: string,
  documentId: string,
): DialogueEntry[] => {
  const dialogueEntries: DialogueEntry[] = []

  // Function to recursively process nodes
  const processNode = (node: any, contextBefore = '', contextAfter = '') => {
    // Handle text nodes with dialogue marks
    if (node.type === 'text' && node.marks) {
      const dialogueMark = node.marks.find(
        (mark: any) => mark.type === 'dialogue' && mark.attrs?.character === characterName,
      )

      if (dialogueMark && node.text) {
        dialogueEntries.push({
          _id: `${documentId}-${dialogueEntries.length}`, // Generate a pseudo-id
          characterId: characterName,
          characterName,
          documentId,
          documentTitle,
          content: node.text,
          context: {
            before: contextBefore,
            after: contextAfter,
          },
          lastUpdated: Date.now(),
          isValid: true,
        })
      }
    }

    // Process child nodes
    if (node.content && Array.isArray(node.content)) {
      // For each node, gather context and process recursively
      node.content.forEach((childNode: any, index: number) => {
        // Simple context extraction (can be enhanced)
        let before = ''
        let after = ''

        // Get text before this node (from previous sibling)
        if (index > 0 && node.content[index - 1].type === 'text') {
          before = node.content[index - 1].text || ''
        }

        // Get text after this node (from next sibling)
        if (index < node.content.length - 1 && node.content[index + 1].type === 'text') {
          after = node.content[index + 1].text || ''
        }

        processNode(childNode, before, after)
      })
    }
  }

  // Start processing from root node
  if (documentContent && documentContent.type === 'doc') {
    processNode(documentContent)
  }

  return dialogueEntries
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
  const [dialogue, setDialogue] = useState<DialogueEntry[]>([])
  const [loadingDialogue, setLoadingDialogue] = useState(false)
  const [initAnimate, setInitAnimate] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitAnimate(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Load dialogue entries when character changes
  useEffect(() => {
    if (character?._id) {
      loadDialogueEntries(character._id)
    }
  }, [character?._id])

  const loadDialogueEntries = async (_characterId: string) => {
    try {
      setLoadingDialogue(true)

      // Ensure we have the character data
      if (!character) return

      // Get all documents instead of just those in the character's documentIds
      const allDocuments = await get('/documents')

      if (!allDocuments || allDocuments.length === 0) {
        setDialogue([])
        return
      }

      // Fetch each document that has content
      const allDialogueEntries: DialogueEntry[] = []
      for (const document of allDocuments) {
        try {
          if (document && document.content) {
            // Extract dialogue entries for this character from the document
            const entriesFromDoc = extractDialogueForCharacter(
              document.content,
              character.name,
              document.title || 'Untitled Document',
              document._id,
            )

            if (entriesFromDoc.length > 0) {
              allDialogueEntries.push(...entriesFromDoc)

              // If this document has dialogue for this character but isn't in documentIds,
              // update the character's documentIds
              if (character._id && character.documentIds && !character.documentIds.includes(document._id)) {
                const updatedDocumentIds = [...character.documentIds, document._id]
                await patch(`/characters/${character._id}`, {
                  documentIds: updatedDocumentIds,
                })
                // Update local character state with the new documentIds
                onCharacterChange({
                  ...character,
                  documentIds: updatedDocumentIds,
                })
              }
            }
          }
        } catch (error) {
          console.error(`Error processing document ${document._id}:`, error)
        }
      }
      debugLog('allDialogueEntries', allDialogueEntries)

      // Sort dialogue entries by document title and position
      allDialogueEntries.sort((a, b) => {
        // Sort by document title first
        if (a.documentTitle !== b.documentTitle) {
          return (a.documentTitle || '').localeCompare(b.documentTitle || '')
        }

        // Then by ID (which includes position information)
        return (a._id || '').localeCompare(b._id || '')
      })

      setDialogue(allDialogueEntries)
    } catch (error) {
      console.error('Error loading dialogue entries:', error)
      setDialogue([])
    } finally {
      setLoadingDialogue(false)
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

  const handleDialogueClick = useCallback(
    (documentId: string) => {
      if (documentId) {
        navigateTo(`/documents/${documentId}`)
      }
    },
    [navigateTo],
  )

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown date'
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const showSpinner = useSpinner(isLoading || userLoading)

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
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] justify-center pb-10">
        <div className="flex w-11/12 max-w-[740px] flex-col justify-center sm:w-9/12">
          {/* Back Button */}
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

          {/* Character Header */}
          <Paper
            elevation={0}
            className="mb-6 overflow-hidden rounded-lg p-6"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}>
            <div className="flex items-center justify-between">
              <Typography variant="h4" className="font-bold">
                {character.name}
              </Typography>
              <Tooltip title="Edit Character">
                <IconButton onClick={() => setEditingCharacter(character)} size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
            </div>

            <Typography variant="subtitle1" className="mt-2 text-black/[.7]">
              <span className="font-semibold">Motivation:</span>{' '}
              {character.motivation || 'No motivation specified'}
            </Typography>

            <Typography variant="body1" className="mt-4 text-black/[.8]">
              {character.description || 'No description available'}
            </Typography>

            {character.traits && character.traits.length > 0 && (
              <Box className="mt-4">
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
              <Box className="mt-4">
                <Typography variant="subtitle2" className="mb-2 font-semibold">
                  Appears in:
                </Typography>
                <div className="flex flex-wrap gap-1">
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

          {/* Dialogue Section */}
          <Typography variant="h5" className="mb-4 font-semibold">
            Character Dialogue
          </Typography>

          {/* Dialogue Entries */}
          <div className="max-h-[calc(100vh_-_300px)] overflow-y-auto">
            {loadingDialogue ? (
              <div className="flex justify-center p-4">
                <Loader />
              </div>
            ) : dialogue.length === 0 ? (
              <Typography variant="body2" className="text-center text-black/[.6]">
                No dialogue found in associated documents
              </Typography>
            ) : (
              dialogue.map((entry: DialogueEntry) => (
                <Paper
                  key={entry._id}
                  elevation={0}
                  className="mb-4 cursor-pointer overflow-hidden rounded-lg p-4 hover:bg-opacity-20"
                  onClick={() => handleDialogueClick(entry.documentId || '')}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    },
                  }}>
                  <div className="flex justify-between">
                    <Typography variant="caption" className="text-black/[.5]">
                      {entry.context?.before || 'No context'}
                    </Typography>
                    <Typography variant="caption" className="text-black/[.5]">
                      {formatDate(entry.lastUpdated)}
                    </Typography>
                  </div>
                  <Typography variant="body1" className="mt-2 italic">
                    &ldquo;{entry.content}&rdquo;
                  </Typography>
                  {entry.documentTitle && (
                    <Typography variant="caption" className="mt-1 block text-black/[.5]">
                      From: {entry.documentTitle}
                    </Typography>
                  )}
                </Paper>
              ))
            )}
          </div>
        </div>
      </div>

      <CharacterModal
        open={!!editingCharacter}
        onClose={() => setEditingCharacter(null)}
        onConfirm={handleUpdateCharacter}
        initialData={editingCharacter}
      />
    </Layout>
  )
}

export default CharacterDetailPage
