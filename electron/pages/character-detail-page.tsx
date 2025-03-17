import CharacterDetailPage from '@components/character-detail-page'
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import useSWR from 'swr'

// Character type definition matching the one in character-detail-page.tsx
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

// Dialogue entry type definition
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

interface SyncUpdates {
  documents?: any[]
  folders?: any[]
  characters?: CharacterData[]
  dialogue?: DialogueEntry[]
}

const ElectronCharacterDetailPage = (props: { params: { id: string } }) => {
  const characterId = props.params.id
  const [location] = useLocation()

  console.log('Character Detail Page - Location:', location)
  console.log('Character Detail Page - Props:', props)
  console.log('Character Detail Page - Character ID:', characterId)

  const {
    data: character,
    mutate: mutateCharacter,
    isLoading,
  } = useSWR<CharacterData>(characterId ? `/characters/${characterId}` : null, window.electronAPI.get, {
    revalidateOnFocus: false,
    focusThrottleInterval: 30000,
    dedupingInterval: 10000,
    revalidateIfStale: false,
  })

  // Listen for sync updates from main process
  useEffect(() => {
    if (!characterId) return

    const removeListener = window.electronAPI.onSyncUpdate((updates: SyncUpdates) => {
      // Handle character updates
      if (updates.characters && updates.characters.length > 0) {
        // Check if our current character is in the updates
        const updatedCharacter = updates.characters.find(
          char => char && typeof char === 'object' && char._id === characterId,
        )

        if (updatedCharacter) {
          mutateCharacter(updatedCharacter, false)
        }
      }

      // Handle dialogue entry updates
      if (updates.dialogue && updates.dialogue.length > 0) {
        console.log('Received dialogue updates:', updates.dialogue.length)
        const updatedEntries = updates.dialogue.filter(
          entry => entry && typeof entry === 'object' && entry.characterId === characterId,
        )

        if (updatedEntries.length > 0) {
          // Trigger a revalidation of dialogue entries
          window.electronAPI.get(`/dialogue/character/${characterId}`)
        }
      }
    })

    return () => {
      removeListener()
    }
  }, [characterId, mutateCharacter])

  const handleCharacterChange = (updatedCharacter: CharacterData) => {
    if (updatedCharacter._id) {
      mutateCharacter(updatedCharacter, { revalidate: false })
    }
  }

  return (
    <CharacterDetailPage
      character={character || null}
      isLoading={isLoading}
      onCharacterChange={handleCharacterChange}
    />
  )
}

export default ElectronCharacterDetailPage
