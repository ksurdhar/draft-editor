import SharedCharactersPage from '@components/shared-characters-page'
import { useEffect } from 'react'
import useSWR from 'swr'

interface CharacterData {
  _id: string
  name: string
  motivation: string
  description: string
  traits: string[]
  relationships: Array<{
    characterId: string
    relationshipType: string
    description: string
  }>
  userId: string
  documentIds: string[]
  lastUpdated: number
  isArchived: boolean
}

interface SyncUpdates {
  documents?: any[]
  folders?: any[]
  characters?: CharacterData[]
}

const ElectronCharactersPage = () => {
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

  // Listen for sync updates from main process
  useEffect(() => {
    const removeListener = window.electronAPI.onSyncUpdate((updates: SyncUpdates) => {
      if (updates.characters && updates.characters.length > 0) {
        // Merge new characters with existing ones, replacing any that have the same ID
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

  return (
    <SharedCharactersPage
      characters={(characters || []).filter(char => char && typeof char === 'object' && char._id)}
      isLoading={charactersLoading}
      onCharactersChange={chars => mutateCharacters(chars, { revalidate: false })}
    />
  )
}

export default ElectronCharactersPage
