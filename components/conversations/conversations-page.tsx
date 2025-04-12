import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import React, { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import { Typography } from '@mui/material'
import CharacterConversations from '@components/conversations/character-conversations'
import ConversationPreview from '@components/conversations/conversation-preview'

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

  const [initAnimate, setInitAnimate] = useState(false)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<ConversationGroup | null>(null)

  // Basic loading spinner logic
  const showSpinner = useSpinner(charactersLoading)

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitAnimate(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

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

  const handleCharacterSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCharacterId(event.target.value || null)
    setSelectedConversation(null)
  }

  const handleConversationSelect = useCallback((conversation: ConversationGroup | null) => {
    setSelectedConversation(conversation)
  }, [])

  const handleCharacterDocumentUpdate = useCallback(
    (updatedDocumentIds: string[]) => {
      console.log('Character document update triggered:', selectedCharacterId, updatedDocumentIds)
    },
    [selectedCharacterId],
  )

  const selectedCharacter = characters?.find(c => c._id === selectedCharacterId)

  return (
    <Layout>
      <div className="gradient-editor fixed left-0 top-0 z-[-1] h-screen w-screen" />
      <div
        className={`gradient duration-[3000ms] fixed left-0 top-0 z-[-1] h-screen w-screen transition-opacity ease-in-out ${
          initAnimate ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div className="fixed top-[44px] flex h-[calc(100vh_-_44px)] w-full flex-col overflow-hidden">
        <div className="flex w-full flex-col items-center p-4">
          <Typography variant="h5" className="mb-4 text-center">
            Conversations
          </Typography>
          {showSpinner ? (
            <div className="flex justify-center pt-10">
              <Loader />
            </div>
          ) : (
            <div className="mb-4">
              <select
                value={selectedCharacterId ?? ''}
                onChange={handleCharacterSelect}
                className="mx-auto block w-full max-w-xs rounded border bg-white/10 p-2 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select a Character</option>
                {(characters || [])
                  .filter(c => c && c._id && !c.isArchived) // Ensure character and ID exist, and not archived
                  .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
                  .map(character => (
                    <option key={character._id} value={character._id}>
                      {character.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {!showSpinner && ( // Keep spinner check
          <div className="mx-auto grid h-[calc(100%_-_100px)] w-11/12 max-w-[1600px] grid-cols-1 gap-6 overflow-hidden px-4 md:grid-cols-2">
            <div className="col-span-1 flex h-full flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
              <CharacterConversations
                key={selectedCharacter?._id ?? 'no-char'} // Use a key that changes
                characterName={selectedCharacter?.name ?? ''} // Pass name or empty string
                characterId={selectedCharacter?._id} // Pass id or undefined
                onCharacterDocumentUpdate={handleCharacterDocumentUpdate}
                onConversationSelect={handleConversationSelect}
                selectedConversationId={selectedConversation?.conversationId}
              />
            </div>
            <div className="col-span-1 flex h-full flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm">
              <ConversationPreview conversation={selectedConversation} />
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default ConversationsPage
