'use client'

import { useState, useEffect, useCallback } from 'react'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import { Typography } from '@mui/material'
import { Button } from '@components/ui/button'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CharacterModal from '@components/character-modal'
import { useLocation } from 'wouter'
// Correct relative imports for files within the same directory
import CharacterDetails from './character-details'
import CharacterConversations from './character-conversations'
// Import the new preview component
import ConversationPreview from './conversation-preview'
// Import Shadcn components
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@components/ui/sheet'
// --- Type Definitions ---
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

// Keep CharacterData definition needed by this page/modal
interface CharacterData {
  _id?: string
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

// Component now acts as a container
const CharacterDetailPageContainer = ({
  character,
  isLoading: isParentLoading,
  onCharacterChange,
}: {
  character: CharacterData | null
  isLoading?: boolean
  onCharacterChange: (character: CharacterData) => void
}) => {
  const { patch } = useAPI()
  const { isLoading: userLoading } = useUser()
  const [, setLocation] = useLocation()
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null)
  const [initAnimate, setInitAnimate] = useState(false)
  // State for the selected conversation to preview
  const [selectedConversation, setSelectedConversation] = useState<ConversationGroup | null>(null)
  // State to control the character details sheet
  const [isCharacterSheetOpen, setIsCharacterSheetOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitAnimate(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleUpdateCharacter = async (characterData: CharacterData) => {
    try {
      if (!characterData._id) {
        console.error('Cannot update character without ID')
        return null
      }
      const updatedCharacter = await patch(`/characters/${characterData._id}`, characterData)
      onCharacterChange(updatedCharacter)
      setEditingCharacter(null)
      return updatedCharacter
    } catch (error) {
      console.error('Error updating character:', error)
      return null
    }
  }

  // Callback to be passed to CharacterConversations (Table)
  const handleConversationSelect = useCallback((conversation: ConversationGroup | null) => {
    setSelectedConversation(conversation)
  }, [])

  const handleCharacterDocumentUpdate = useCallback(
    (updatedDocumentIds: string[]) => {
      if (
        character &&
        character._id &&
        JSON.stringify(character.documentIds) !== JSON.stringify(updatedDocumentIds)
      ) {
        console.log('Updating character document IDs from conversation component', updatedDocumentIds)
        onCharacterChange({ ...character, documentIds: updatedDocumentIds })
        patch(`/characters/${character._id}`, { documentIds: updatedDocumentIds }).catch(error =>
          console.error('Failed to update character documentIds:', error),
        )
      }
    },
    [character, onCharacterChange, patch],
  )

  const showSpinner = useSpinner(isParentLoading || userLoading)

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
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] flex-col pb-5">
        <div className="mx-auto flex w-11/12 max-w-[1600px] items-center justify-between px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => setLocation('/characters')}>
            <ArrowBackIcon className="mr-2 h-4 w-4" />
            Back to Characters
          </Button>

          <Sheet open={isCharacterSheetOpen} onOpenChange={setIsCharacterSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="text-lg font-semibold">
                {character.name}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Character: {character.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <CharacterDetails character={character} onEditClick={() => setEditingCharacter(character)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mx-auto grid w-11/12 max-w-[1600px] flex-1 grid-cols-1 gap-6 overflow-hidden px-4 md:grid-cols-2">
          <div className="bg-card text-card-foreground col-span-1 flex flex-col overflow-hidden rounded-lg border shadow-sm">
            <CharacterConversations
              key={character.name}
              characterName={character.name}
              characterId={character._id}
              onCharacterDocumentUpdate={handleCharacterDocumentUpdate}
              onConversationSelect={handleConversationSelect}
              selectedConversationId={selectedConversation?.conversationId}
            />
          </div>
          <div className="bg-card text-card-foreground not-prose col-span-1 flex flex-col overflow-hidden rounded-lg border shadow-sm">
            <ConversationPreview conversation={selectedConversation} characterName={character.name} />
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

export default CharacterDetailPageContainer
