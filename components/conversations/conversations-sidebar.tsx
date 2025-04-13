'use client'

import React, { useState } from 'react'
import { Typography } from '@mui/material'
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
import { Check, ChevronsUpDown, X, Filter, MessageSquare } from 'lucide-react'
import { Badge } from '@components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@components/ui/sidebar'

// --- Type definitions (mirrored from conversations-page) ---

interface CharacterData {
  _id: string
  name: string
  isArchived?: boolean
}

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

interface DialogueEntry {
  characterId: string
  characterName: string
  documentId?: string
  documentTitle?: string
  contentNode: TiptapNode
}

interface ConversationGroup {
  conversationId: string
  conversationName: string | null
  documentId: string
  documentTitle: string
  entries: DialogueEntry[]
  lastUpdated?: number
}

// --- Component Props Interface ---

interface ConversationsSidebarProps {
  allCharacters: CharacterData[]
  filteredConversations: ConversationGroup[]
  selectedCharacterIds: string[]
  selectedConversationId: string | null
  onCharacterSelectionChange: (characterId: string) => void
  onClearFilters: () => void
  onSelectAllCharacters: () => void
  onConversationSelect: (conversation: ConversationGroup) => void
}

// Helper to get unique character names from a conversation group
const getUniqueCharacterNames = (entries: DialogueEntry[]): string[] => {
  const names = new Set<string>()
  entries.forEach(entry => names.add(entry.characterName))
  return Array.from(names).sort()
}

const ConversationsSidebar: React.FC<ConversationsSidebarProps> = ({
  allCharacters,
  filteredConversations,
  selectedCharacterIds,
  selectedConversationId,
  onCharacterSelectionChange,
  onClearFilters,
  onSelectAllCharacters,
  onConversationSelect,
}) => {
  const [commandOpen, setCommandOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const nonArchivedCharacters = React.useMemo(() => {
    return allCharacters.filter(c => !c.isArchived).sort((a, b) => a.name.localeCompare(b.name))
  }, [allCharacters])

  const selectedCharacterNames = React.useMemo(() => {
    return selectedCharacterIds
      .map(id => allCharacters.find(c => c._id === id)?.name || '')
      .filter(name => name !== '')
  }, [selectedCharacterIds, allCharacters])

  const displayedConversations = React.useMemo(() => {
    if (!searchTerm) return filteredConversations
    const lowerSearchTerm = searchTerm.toLowerCase()
    return filteredConversations.filter(convo => {
      const conversationDisplayName =
        convo.conversationName || `Conversation ${convo.conversationId.replace('conv', '')}`
      const docTitle = convo.documentTitle || ''
      const participants = getUniqueCharacterNames(convo.entries)

      return (
        conversationDisplayName.toLowerCase().includes(lowerSearchTerm) ||
        docTitle.toLowerCase().includes(lowerSearchTerm) ||
        participants.some(p => p.toLowerCase().includes(lowerSearchTerm))
      )
    })
  }, [filteredConversations, searchTerm])

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="gap-3.5 border-b p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="justify-start px-0" asChild>
              <Typography variant="h6" className="font-semibold">
                Conversations
              </Typography>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex w-full flex-col gap-2 data-[collapsed=true]:hidden">
          <Popover open={commandOpen} onOpenChange={setCommandOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={commandOpen}
                className="w-full justify-between">
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
                          onClick={onSelectAllCharacters}
                          className="mr-1 h-7">
                          Select all
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClearFilters} className="ml-1 h-7">
                          Clear
                        </Button>
                      </div>
                    </div>
                    {nonArchivedCharacters.map(character => (
                      <CommandItem
                        key={character._id}
                        onSelect={() => onCharacterSelectionChange(character._id)}
                        className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Checkbox
                            id={`sidebar-character-${character._id}`}
                            checked={selectedCharacterIds.includes(character._id)}
                            onCheckedChange={() => onCharacterSelectionChange(character._id)}
                            className="mr-2"
                          />
                          {character.name}
                        </div>
                        {selectedCharacterIds.includes(character._id) && <Check className="h-4 w-4" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="flex min-h-[24px] flex-wrap items-center gap-1">
            {selectedCharacterNames.length > 0 ? (
              <>
                {selectedCharacterNames.map(name => (
                  <Badge key={name} variant="secondary" className="flex items-center gap-1">
                    {name}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => {
                        const charId = allCharacters?.find(c => c.name === name)?._id
                        if (charId) onCharacterSelectionChange(charId)
                      }}
                    />
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-6 px-2">
                  Clear all
                </Button>
              </>
            ) : (
              <Typography variant="caption" className="text-muted-foreground">
                Showing all conversations
              </Typography>
            )}
          </div>

          <SidebarInput
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-0">
        <SidebarGroup className="px-0">
          <SidebarGroupContent className="overflow-y-auto">
            {displayedConversations.length === 0 ? (
              <div className="flex h-full items-center justify-center p-4 data-[collapsed=true]:hidden">
                <Typography variant="body2" className="text-center text-muted-foreground">
                  No conversations found with the current filters.
                </Typography>
              </div>
            ) : (
              displayedConversations.map(convo => {
                const uniqueCharacters = getUniqueCharacterNames(convo.entries)
                const isSelected = convo.conversationId === selectedConversationId
                const conversationDisplayName =
                  convo.conversationName || `Conversation ${convo.conversationId.replace('conv', '')}`

                return (
                  <SidebarMenuItem
                    key={`${convo.documentId}-${convo.conversationId}`}
                    className="list-none p-0">
                    <SidebarMenuButton
                      onClick={() => onConversationSelect(convo)}
                      isActive={isSelected}
                      className={`group h-auto flex-col items-start gap-1 whitespace-nowrap p-3 text-sm leading-tight data-[collapsed=true]:h-12 data-[collapsed=true]:items-center data-[collapsed=true]:justify-center data-[state=active]:bg-muted/80 data-[collapsed=true]:p-2`}
                      tooltip={{
                        children: conversationDisplayName,
                        side: 'right',
                        sideOffset: 10,
                      }}>
                      <div className="w-full data-[collapsed=true]:hidden">
                        <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate" title={convo.documentTitle || 'Untitled Document'}>
                            {convo.documentTitle || 'Untitled Document'}
                          </span>
                        </div>
                        <span className="font-medium">{conversationDisplayName}</span>
                        <div className="flex flex-wrap gap-1">
                          {uniqueCharacters.map(name => (
                            <Badge key={name} variant="secondary">
                              {name}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="hidden w-full items-center justify-center data-[collapsed=true]:flex">
                        <MessageSquare className="size-5 text-muted-foreground group-data-[state=active]:text-accent-foreground" />
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

export default ConversationsSidebar
