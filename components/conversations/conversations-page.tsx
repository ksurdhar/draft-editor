import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import ConversationPreview from '@components/conversations/conversation-preview'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@components/ui/sidebar'
import ConversationsSidebar from './conversations-sidebar'
import { Separator } from '@components/ui/separator'
import { useAPI } from '@components/providers'
import { toast } from 'sonner'

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
  lastUpdated?: number,
): ConversationGroup[] => {
  const conversationsMap: Record<string, ConversationGroup> = {}

  let parsedContent = documentContent
  if (typeof documentContent === 'string') {
    try {
      parsedContent = JSON.parse(documentContent)
    } catch (e) {
      console.error(`Failed to parse content for doc ${documentId} in extractAllConversations:`, e)
      return []
    }
  }

  if (!parsedContent || parsedContent.type !== 'doc') {
    console.warn(`Invalid content structure for doc ${documentId} in extractAllConversations`)
    return []
  }

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
              lastUpdated: lastUpdated || Date.now(),
            }
          }
          if (conversationName && conversationsMap[conversationId].conversationName !== conversationName) {
            if (conversationsMap[conversationId].conversationName === null) {
              conversationsMap[conversationId].conversationName = conversationName
            }
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

  processNode(parsedContent)

  return Object.values(conversationsMap)
}

// Helper function to update conversation names within Tiptap content
const updateConversationNameInContent = (content: any, conversationId: string, newName: string): any => {
  let parsedContent = content
  if (typeof content === 'string') {
    try {
      parsedContent = JSON.parse(content)
    } catch (e) {
      console.error('Failed to parse content in updateConversationNameInContent:', e)
      return content
    }
  }

  if (!parsedContent || typeof parsedContent !== 'object') {
    return parsedContent
  }

  let modified = false

  const traverseAndUpdate = (node: TiptapNode): TiptapNode => {
    let updatedNode = { ...node }

    if (node.marks) {
      updatedNode.marks = node.marks.map(mark => {
        if (
          mark.type === 'dialogue' &&
          mark.attrs?.conversationId === conversationId &&
          mark.attrs?.conversationName !== newName
        ) {
          modified = true
          return {
            ...mark,
            attrs: {
              ...mark.attrs,
              conversationName: newName || null,
            },
          }
        }
        return mark
      })
    }

    if (node.content && Array.isArray(node.content)) {
      updatedNode.content = node.content.map(traverseAndUpdate)
    }

    return updatedNode
  }

  const updatedContent = traverseAndUpdate(parsedContent)

  return modified ? updatedContent : parsedContent
}

const ConversationsPage = () => {
  const { get, patch } = useAPI()
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
    if (!documents || documents.length === 0) {
      setAllConversations([])
      return
    }

    const extractedConversations: ConversationGroup[] = []

    for (const document of documents) {
      if (!document || !document._id) continue

      try {
        const conversationsFromDoc = extractAllConversations(
          document.content,
          document.title || 'Untitled Document',
          document._id,
          document.lastUpdated,
        )
        extractedConversations.push(...conversationsFromDoc)
      } catch (error) {
        console.error(`Error processing document ${document._id} for conversations:`, error)
      }
    }

    // Sort conversations by document title, then conversation ID
    extractedConversations.sort((a, b) => {
      if (a.documentTitle !== b.documentTitle) {
        return (a.documentTitle || '').localeCompare(b.documentTitle || '')
      }
      // Simple numeric sort for conv IDs if possible
      const aNum = parseInt(a.conversationId.replace(/\D/g, ''), 10)
      const bNum = parseInt(b.conversationId.replace(/\D/g, ''), 10)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum
      }
      return a.conversationId.localeCompare(b.conversationId)
    })

    setAllConversations(extractedConversations)

    // If a conversation was selected, update its data from the new list
    // to ensure consistency after document updates.
    setSelectedConversation(prevSelected => {
      if (!prevSelected) return null
      return extractedConversations.find(c => c.conversationId === prevSelected.conversationId) || null
    })
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
        }, false)
      }
    })

    return () => {
      removeListener()
    }
  }, [mutateCharacters])

  // Filter conversations based on selected characters
  const filteredConversations = useMemo(() => {
    if (selectedCharacterIds.length === 0) {
      return allConversations
    }

    return allConversations.filter(conversation => {
      const conversationCharacters = new Set(conversation.entries.map(entry => entry.characterName))

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
      if (selectedConversation?.conversationId !== conversation?.conversationId) {
        setIsEditing(false)
      }
      setSelectedConversation(conversation)
    },
    [selectedConversation?.conversationId],
  )

  // --- Function to handle updating conversation name --- START
  const handleUpdateConversationName = useCallback(
    async (conversationId: string, newName: string) => {
      const conversationToUpdate = allConversations.find(c => c.conversationId === conversationId)
      if (!conversationToUpdate) {
        console.error(`Conversation with ID ${conversationId} not found in local state.`)
        toast.error('Could not find conversation to update.')
        throw new Error('Conversation not found')
      }

      const { documentId } = conversationToUpdate
      let originalContent: any = null
      let updatedContent: any = null

      try {
        // 1. Fetch the full document
        const fullDocument = await get(`/documents/${documentId}`)
        if (!fullDocument || !fullDocument.content) {
          console.error(`Failed to fetch document ${documentId} for update.`)
          toast.error('Failed to load document data for update.')
          throw new Error('Document fetch failed')
        }
        originalContent = fullDocument.content

        // 2. Update the name in the content
        updatedContent = updateConversationNameInContent(originalContent, conversationId, newName)

        // 3. Check if content was actually modified
        if (updatedContent === originalContent) {
          console.log('Conversation name already up-to-date. No API call needed.')
        } else {
          // 4. Patch the document via API
          await patch(`/documents/${documentId}`, {
            content: JSON.stringify(updatedContent),
            lastUpdated: Date.now(),
          })
          console.log(`Document ${documentId} patched successfully with new conversation name.`)
          toast.success('Conversation name updated!')
        }

        // 5. Update local state immediately for responsiveness
        setAllConversations(prevConversations =>
          prevConversations.map(conv =>
            conv.conversationId === conversationId ? { ...conv, conversationName: newName } : conv,
          ),
        )
        setSelectedConversation(prevSelected =>
          prevSelected?.conversationId === conversationId
            ? { ...prevSelected, conversationName: newName }
            : prevSelected,
        )
      } catch (error) {
        console.error(`Error updating conversation name for ${conversationId}:`, error)
        toast.error(
          `Failed to update conversation name: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
        throw error
      }
    },
    [allConversations, get, patch],
  )
  // --- Function to handle updating conversation name --- END

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
                  onUpdateConversationName={handleUpdateConversationName}
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
