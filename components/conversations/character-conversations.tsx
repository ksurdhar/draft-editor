'use client'

import { useState } from 'react'
import { Typography } from '@mui/material'
import { Loader } from '@components/loader'
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

// --- Component Definition ---

interface CharacterConversationsProps {
  allConversations: ConversationGroup[]
  onConversationSelect: (conversation: ConversationGroup | null) => void
  selectedConversationId?: string | null
}

const CharacterConversations: React.FC<CharacterConversationsProps> = ({
  allConversations,
  onConversationSelect,
  selectedConversationId,
}) => {
  const [isLoading] = useState(false) // Keeping a loading state placeholder

  // Helper to get unique character names from a conversation group
  const getUniqueCharacterNames = (entries: DialogueEntry[]): string[] => {
    const names = new Set<string>()
    entries.forEach(entry => names.add(entry.characterName))
    return Array.from(names)
  }

  // --- Rendering Logic --- //

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Loader />
        </div>
      ) : allConversations.length === 0 ? (
        <div className="flex h-full items-center justify-center p-4">
          <Typography variant="body2" className="text-center text-muted-foreground">
            No conversations found with the current filters.
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
            {allConversations.map(convo => {
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
                  <TableCell
                    className="max-w-[150px] truncate"
                    title={convo.documentTitle || 'Untitled Document'}>
                    {convo.documentTitle || 'Untitled Document'}
                  </TableCell>
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
  )
}

export default CharacterConversations
