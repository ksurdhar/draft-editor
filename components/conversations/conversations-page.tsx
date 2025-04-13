import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import ConversationPreview from '@components/conversations/conversation-preview'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@components/ui/sidebar'
import ConversationsSidebar from './conversations-sidebar'
import { Separator } from '@components/ui/separator'

// Re-use the CharacterData interface (consider moving to a shared types file later)
interface CharacterData {
  _id: string
  name: string
  motivation: string
  description: string
  traits: string[]
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

// DialogueEntry type (from character-detail)
interface DialogueEntry {
  characterId: string
  characterName: string
  documentId?: string
  documentTitle?: string
  contentNode: TiptapNode
}

// ConversationGroup type (from character-detail)
interface ConversationGroup {
  conversationId: string
  conversationName: string | null
  documentId: string
  documentTitle: string
  entries: DialogueEntry[]
  lastUpdated?: number
}

// Reuse the SyncUpdates interface from characters-page
interface SyncUpdates {
  documents?: any[]
  folders?: any[]
  characters?: CharacterData[]
}

// Add local Tiptap type definitions (mirroring character-detail/index.tsx)
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

// Helper function to extract all conversations from a document
const extractAllConversations = (
  documentContent: any,
  documentTitle: string,
  documentId: string,
): ConversationGroup[] => {
  const conversationsMap: Record<string, ConversationGroup> = {}

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
        console.error('Failed to parse document content in extractAllConversations:', e)
        return []
      }
    } else {
      parsedContent = documentContent
    }
    processNode(parsedContent)
  } else if (documentContent && typeof documentContent !== 'object') {
    try {
      const parsedContent = JSON.parse(documentContent)
      if (parsedContent && parsedContent.type === 'doc') {
        processNode(parsedContent)
      }
    } catch (e) {
      console.error('Failed to parse non-object document content:', e)
      return []
    }
  }

  return Object.values(conversationsMap)
}

const ConversationsPage = () => {
  const {
    data: characters,
    mutate: mutateCharacters,
    isLoading: charactersLoading,
  } = useSWR<CharacterData[]>('/characters', window.electronAPI.get, {
    revalidateOnFocus: false,
    focusThrottleInterval: 30000,
    dedupingInterval: 10000,
    revalidateIfStale: false,
  })

  const { data: documents, isLoading: documentsLoading } = useSWR('/documents', window.electronAPI.get, {
    revalidateOnFocus: false,
    focusThrottleInterval: 30000,
    dedupingInterval: 10000,
    revalidateIfStale: false,
  })

  const [initAnimate, setInitAnimate] = useState(false)
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ConversationGroup | null>(null)
  const [allConversations, setAllConversations] = useState<ConversationGroup[]>([])
  const [isEditing, setIsEditing] = useState(false)

  // Basic loading spinner logic
  const showSpinner = useSpinner(charactersLoading || documentsLoading)

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitAnimate(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Extract all conversations from all documents
  useEffect(() => {
    if (!documents || documents.length === 0) return

    const extractedConversations: ConversationGroup[] = []

    for (const document of documents) {
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
          const conversationsFromDoc = extractAllConversations(
            contentToParse,
            document.title || 'Untitled Document',
            document._id,
          )
          extractedConversations.push(...conversationsFromDoc)
        }
      } catch (error) {
        console.error(`Error processing document ${document._id} for conversations:`, error)
      }
    }

    // Sort conversations
    extractedConversations.sort((a, b) => {
      if (a.documentTitle !== b.documentTitle) {
        return (a.documentTitle || '').localeCompare(b.documentTitle || '')
      }
      return a.conversationId.localeCompare(b.conversationId)
    })

    setAllConversations(extractedConversations)
  }, [documents])

  // Listener for sync updates (similar to characters-page)
  useEffect(() => {
    const removeListener = window.electronAPI.onSyncUpdate((updates: SyncUpdates) => {
      if (updates.characters && updates.characters.length > 0) {
        mutateCharacters(currentChars => {
          const currentCharsMap = new Map(
            (currentChars || [])
              .filter(char => char && typeof char === 'object' && char._id)
              .map(char => [char._id, char]),
          )
          updates
            .characters!.filter(char => char && typeof char === 'object' && char._id)
            .forEach(char => currentCharsMap.set(char._id, char))
          return Array.from(currentCharsMap.values())
        }, false) // Don't revalidate immediately
      }
    })

    return () => {
      removeListener()
    }
  }, [mutateCharacters])

  // Filter conversations based on selected characters
  const filteredConversations = useMemo(() => {
    if (selectedCharacterIds.length === 0) {
      return allConversations // Show all if no filters applied
    }

    return allConversations.filter(conversation => {
      // Check if any selected character is in this conversation
      const conversationCharacters = new Set(conversation.entries.map(entry => entry.characterName))

      // If any selected character is in this conversation, include it
      for (const characterId of selectedCharacterIds) {
        const character = characters?.find(c => c._id === characterId)
        if (character && conversationCharacters.has(character.name)) {
          return true
        }
      }
      return false
    })
  }, [allConversations, selectedCharacterIds, characters])

  const handleCharacterSelectionChange = (characterId: string) => {
    setSelectedCharacterIds(prev => {
      if (prev.includes(characterId)) {
        return prev.filter(id => id !== characterId)
      } else {
        return [...prev, characterId]
      }
    })
    setSelectedConversation(null)
  }

  const handleClearFilters = () => {
    setSelectedCharacterIds([])
    setSelectedConversation(null)
  }

  const handleSelectAllCharacters = () => {
    if (!characters) return
    const nonArchivedCharacterIds = characters.filter(c => !c.isArchived).map(c => c._id)
    setSelectedCharacterIds(nonArchivedCharacterIds)
    setSelectedConversation(null)
  }

  const handleConversationSelect = useCallback(
    (conversation: ConversationGroup | null) => {
      setIsEditing(false)
      setSelectedConversation(conversation)
    },
    [setIsEditing],
  )

  const nonArchivedCharacters = useMemo(() => {
    return (characters || []).filter(c => !c.isArchived).sort((a, b) => a.name.localeCompare(b.name))
  }, [characters])

  return (
    <Layout>
      <div className="gradient-editor fixed left-0 top-0 z-[-1] h-screen w-screen" />
      <div
        className={`gradient duration-[3000ms] fixed left-0 top-0 z-[-1] h-screen w-screen transition-opacity ease-in-out ${
          initAnimate ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className="fixed top-[44px] flex h-[calc(100vh_-_44px)] w-full flex-col overflow-hidden">
        {showSpinner ? (
          <div className="flex h-full items-center justify-center pt-10">
            <Loader />
          </div>
        ) : (
          <SidebarProvider style={{ '--sidebar-width': '300px' } as React.CSSProperties}>
            <ConversationsSidebar
              allCharacters={nonArchivedCharacters}
              filteredConversations={filteredConversations}
              selectedCharacterIds={selectedCharacterIds}
              selectedConversationId={selectedConversation?.conversationId ?? null}
              onCharacterSelectionChange={handleCharacterSelectionChange}
              onClearFilters={handleClearFilters}
              onSelectAllCharacters={handleSelectAllCharacters}
              onConversationSelect={handleConversationSelect}
            />
            <SidebarInset>
              <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b bg-background/80 p-3 backdrop-blur-md">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="h-6" />
                <span className="font-semibold">Conversation Preview</span>
              </header>
              <div className="flex flex-1 flex-col overflow-hidden bg-card/60 backdrop-blur-md">
                <ConversationPreview
                  conversation={selectedConversation}
                  isEditing={isEditing}
                  setIsEditing={setIsEditing}
                />
              </div>
            </SidebarInset>
          </SidebarProvider>
        )}
      </div>
    </Layout>
  )
}

export default ConversationsPage
