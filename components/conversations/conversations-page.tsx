import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { Typography } from '@mui/material'
import CharacterConversations from '@components/conversations/character-conversations'
import ConversationPreview from '@components/conversations/conversation-preview'
import { Checkbox } from '@components/ui/checkbox'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@components/ui/popover'
import { Button } from '@components/ui/button'
import { Check, ChevronsUpDown, X, Filter } from 'lucide-react'
import { Badge } from '@components/ui/badge'

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
  const [commandOpen, setCommandOpen] = useState(false)

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
      // If character is already selected, remove it; otherwise add it
      if (prev.includes(characterId)) {
        return prev.filter(id => id !== characterId)
      } else {
        return [...prev, characterId]
      }
    })

    // Clear conversation selection when changing character filter
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

  const handleConversationSelect = useCallback((conversation: ConversationGroup | null) => {
    setSelectedConversation(conversation)
  }, [])

  const nonArchivedCharacters = useMemo(() => {
    return (characters || []).filter(c => !c.isArchived).sort((a, b) => a.name.localeCompare(b.name))
  }, [characters])

  // Get selected character names for display
  const selectedCharacterNames = useMemo(() => {
    if (!characters) return []
    return selectedCharacterIds
      .map(id => characters.find(c => c._id === id)?.name || '')
      .filter(name => name !== '')
  }, [selectedCharacterIds, characters])

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
          {showSpinner ? (
            <div className="flex justify-center pt-10">
              <Loader />
            </div>
          ) : (
            <div className="mx-auto grid h-[calc(100vh_-_80px)] w-11/12 max-w-[1600px] grid-cols-1 gap-6 overflow-hidden px-4 md:grid-cols-2">
              <div className="col-span-1 flex h-full flex-col overflow-hidden rounded-lg border bg-card/80 text-card-foreground shadow-sm backdrop-blur-md">
                <div className="border-b bg-card/20 p-4 backdrop-blur-lg">
                  <Typography variant="h6" className="mb-4 font-semibold">
                    Conversations
                  </Typography>

                  <div className="mb-1 flex w-full items-center justify-between gap-2">
                    <Popover open={commandOpen} onOpenChange={setCommandOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={commandOpen}
                          className="min-w-[200px] justify-between">
                          <Filter className="mr-2 h-4 w-4" />
                          Filter by characters
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search characters..." />
                          <CommandList>
                            <CommandEmpty>No characters found.</CommandEmpty>
                            <CommandGroup heading="Characters">
                              <div className="border-b px-2 py-1.5">
                                <div className="flex items-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSelectAllCharacters}
                                    className="mr-1 h-7">
                                    Select all
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearFilters}
                                    className="ml-1 h-7">
                                    Clear
                                  </Button>
                                </div>
                              </div>
                              {nonArchivedCharacters.map(character => (
                                <CommandItem
                                  key={character._id}
                                  onSelect={() => handleCharacterSelectionChange(character._id)}
                                  className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <Checkbox
                                      id={`character-${character._id}`}
                                      checked={selectedCharacterIds.includes(character._id)}
                                      onCheckedChange={() => handleCharacterSelectionChange(character._id)}
                                      className="mr-2"
                                    />
                                    {character.name}
                                  </div>
                                  {selectedCharacterIds.includes(character._id) && (
                                    <Check className="h-4 w-4" />
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    <div className="flex flex-wrap items-center gap-1">
                      {selectedCharacterNames.length > 0 ? (
                        <>
                          {selectedCharacterNames.map(name => (
                            <Badge key={name} variant="secondary" className="flex items-center gap-1">
                              {name}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => {
                                  const charId = characters?.find(c => c.name === name)?._id
                                  if (charId) handleCharacterSelectionChange(charId)
                                }}
                              />
                            </Badge>
                          ))}
                          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-6 px-2">
                            Clear all
                          </Button>
                        </>
                      ) : (
                        <Typography variant="caption" className="text-muted-foreground">
                          Showing all conversations
                        </Typography>
                      )}
                    </div>
                  </div>
                </div>
                <CharacterConversations
                  key={`conversation-list-${selectedCharacterIds.join('-')}`}
                  allConversations={filteredConversations}
                  onConversationSelect={handleConversationSelect}
                  selectedConversationId={selectedConversation?.conversationId}
                />
              </div>
              <div className="col-span-1 flex h-full flex-col overflow-hidden rounded-lg border bg-card/60 text-card-foreground shadow-sm backdrop-blur-md">
                <ConversationPreview conversation={selectedConversation} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default ConversationsPage
