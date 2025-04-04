'use client'

import { useState, useEffect, useCallback } from 'react'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import { Typography, Button } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CharacterModal from '@components/character-modal'
import { useLocation } from 'wouter'
// Correct relative imports for files within the same directory
import CharacterDetails from './character-details'
import CharacterConversations from './character-conversations'

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
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] flex-col justify-center pb-5">
        <div className="mx-auto w-11/12 max-w-[1200px] px-4">
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => setLocation('/characters')}
            variant="text"
            className="mb-4 self-start"
            sx={{
              color: 'rgba(0, 0, 0, 0.87)',
              '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            }}>
            Back to Characters
          </Button>
        </div>
        <div className="mx-auto grid w-11/12 max-w-[1200px] flex-1 grid-cols-1 gap-6 overflow-hidden px-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <CharacterDetails character={character} onEditClick={() => setEditingCharacter(character)} />
          </div>
          <div className="md:col-span-2">
            <CharacterConversations
              key={character.name}
              characterName={character.name}
              characterId={character._id}
              onCharacterDocumentUpdate={handleCharacterDocumentUpdate}
            />
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
