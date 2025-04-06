'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Typography } from '@mui/material'
import { useAPI } from '@components/providers'
import { useNavigation } from '@components/providers'
import { Loader } from '@components/loader'
import { debugLog } from '@lib/debug-logger'
import { DocumentData } from '@typez/globals'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table'
import { Badge } from '@components/ui/badge'

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
  conversationName: string | null
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
          const conversationName = mark.attrs?.conversationName || null

          if (!conversationsMap[conversationId]) {
            conversationsMap[conversationId] = {
              conversationId,
              conversationName,
              documentId,
              documentTitle,
              entries: [],
              lastUpdated: Date.now(),
            }
            characterParticipates[conversationId] = false
          }
          if (conversationName && !conversationsMap[conversationId].conversationName) {
            conversationsMap[conversationId].conversationName = conversationName
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
  onConversationSelect: (conversation: ConversationGroup | null) => void
  selectedConversationId?: string | null
}

const CharacterConversations: React.FC<CharacterConversationsProps> = ({
  characterName,
  characterId: _characterId,
  onCharacterDocumentUpdate,
  onConversationSelect,
  selectedConversationId,
}) => {
  const { get } = useAPI()
  const { navigateTo } = useNavigation()
  const [conversations, setConversations] = useState<ConversationGroup[]>([])
  const [loadingConversations, setLoadingConversations] = useState(false)

  // Function to load conversations (extracted and adapted)
  const loadConversations = useCallback(
    async (charName: string) => {
      setLoadingConversations(true)
      setConversations([])
      let updatedDocIdsMap = new Set<string>()

      try {
        const allDocuments = await get('/documents')
        if (!allDocuments || allDocuments.length === 0) {
          setLoadingConversations(false)
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
                updatedDocIdsMap.add(document._id)
              }
            }
          } catch (error) {
            console.error(`Error processing document ${document._id} for conversations:`, error)
          }
        }

        // Sort conversations (e.g., by document title then conversation ID)
        allConversationGroups.sort((a, b) => {
          if (a.documentTitle !== b.documentTitle) {
            return (a.documentTitle || '').localeCompare(b.documentTitle || '')
          }
          // Simple numeric sort if IDs are numbers, otherwise localeCompare
          return a.conversationId.localeCompare(b.conversationId)
        })

        setConversations(allConversationGroups)

        if (onCharacterDocumentUpdate) {
          onCharacterDocumentUpdate(Array.from(updatedDocIdsMap))
        }
      } catch (error) {
        console.error('Error loading conversation groups:', error)
      } finally {
        setLoadingConversations(false)
      }
    },
    [get, onCharacterDocumentUpdate],
  )

  // Load conversations when character name changes
  useEffect(() => {
    if (characterName) {
      loadConversations(characterName)
    }
    // Reset selection when character changes
    onConversationSelect(null)
  }, [characterName, loadConversations, onConversationSelect])

  // Helper to get unique character names from a conversation group
  const getUniqueCharacterNames = (entries: DialogueEntry[]): string[] => {
    const names = new Set<string>()
    entries.forEach(entry => names.add(entry.characterName))
    return Array.from(names)
  }

  // --- Rendering Logic --- //

  return (
    <div className="flex h-full flex-col p-4">
      <Typography variant="h6" className="mb-4 font-semibold">
        Conversations
      </Typography>

      <div className="flex-1 overflow-y-auto">
        {loadingConversations ? (
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Typography variant="body2" className="text-muted-foreground text-center">
              No conversations found involving this character.
            </Typography>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Conversation</TableHead>
                <TableHead>Participants</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map(convo => {
                const uniqueCharacters = getUniqueCharacterNames(convo.entries).sort()
                const isSelected = convo.conversationId === selectedConversationId
                const conversationDisplayName =
                  convo.conversationName || `Conversation ${convo.conversationId.replace('conv', '')}`

                return (
                  <TableRow
                    key={`${convo.documentId}-${convo.conversationId}`}
                    onClick={() => onConversationSelect(convo)}
                    className={`cursor-pointer ${isSelected ? 'bg-muted/50' : ''}`}
                    data-state={isSelected ? 'selected' : undefined}>
                    <TableCell>{convo.documentTitle || 'Untitled Document'}</TableCell>
                    <TableCell className="font-medium">{conversationDisplayName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {uniqueCharacters.map(name => (
                          <Badge key={name} variant="secondary">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

export default CharacterConversations
