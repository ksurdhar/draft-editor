'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useEntities, EntityType, AnyEntity } from '@components/providers'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@components/ui/command'
import { ChevronRight, FileText, MessageSquare, Camera, Loader2 } from 'lucide-react'
import { cn } from '@components/lib/utils'

// Styling constants
const ENTITY_ICONS = {
  document: <FileText className="mr-2 h-4 w-4" />,
  conversation: <MessageSquare className="mr-2 h-4 w-4" />,
  scene: <Camera className="mr-2 h-4 w-4" />,
}

// Props for the entity selector
interface EntitySelectorProps {
  isActive: boolean
  selectedType: EntityType | null
  searchTerm: string
  onSelect: (entity: AnyEntity) => void
  onSelectType: (type: EntityType) => void
  onClose: () => void
}

export function EntitySelector({
  isActive,
  selectedType,
  searchTerm,
  onSelect,
  onSelectType,
  onClose,
}: EntitySelectorProps) {
  const { isLoading, filterEntities } = useEntities()
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const commandRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter entities based on selected type and search term
  const filteredEntities = selectedType ? filterEntities(selectedType, searchTerm) : []

  // Entity types for selection
  const entityTypes: EntityType[] = ['document', 'conversation', 'scene']

  // When active state changes, reset the highlighted index
  useEffect(() => {
    setHighlightedIndex(0)
  }, [isActive, selectedType, searchTerm])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default behavior for arrow keys to avoid text cursor movement
      if (['ArrowUp', 'ArrowDown', 'Tab', 'Enter'].includes(e.key)) {
        e.preventDefault()
      }

      if (e.key === 'ArrowUp') {
        setHighlightedIndex(prev => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowDown') {
        const maxIndex = selectedType ? filteredEntities.length - 1 : entityTypes.length - 1
        setHighlightedIndex(prev => Math.min(maxIndex, prev + 1))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (selectedType) {
          if (filteredEntities.length > 0 && highlightedIndex < filteredEntities.length) {
            onSelect(filteredEntities[highlightedIndex])
          }
        } else {
          if (highlightedIndex < entityTypes.length) {
            onSelectType(entityTypes[highlightedIndex])
          }
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    isActive,
    highlightedIndex,
    selectedType,
    filteredEntities,
    entityTypes,
    onSelect,
    onSelectType,
    onClose,
  ])

  // Scroll highlighted item into view
  useEffect(() => {
    if (listRef.current && isActive) {
      const highlighted = listRef.current.querySelector('[data-highlighted="true"]')
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isActive])

  // Position the selector
  const selectorStyle = {
    minWidth: '250px',
    maxWidth: '400px',
    maxHeight: '300px',
    zIndex: 50,
  }

  if (!isActive) return null

  return (
    <div
      ref={commandRef}
      className="entity-selector rounded-md border bg-popover shadow-md"
      style={selectorStyle}>
      <Command className="max-h-[300px]">
        <CommandInput
          placeholder={selectedType ? `Search ${selectedType}s...` : 'Select entity type...'}
          value={searchTerm}
          readOnly={true}
          className="h-9"
        />

        <CommandList ref={listRef} className="max-h-[240px] overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-2">Loading entities...</span>
            </div>
          )}

          {!selectedType ? (
            // Show entity types for selection
            <CommandGroup heading="Select entity type">
              {entityTypes.map((type, index) => (
                <CommandItem
                  key={type}
                  data-highlighted={highlightedIndex === index}
                  className={cn(
                    highlightedIndex === index && 'bg-accent',
                    'flex cursor-pointer items-center',
                  )}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={e => {
                    e.preventDefault()
                    onSelectType(type)
                  }}>
                  {ENTITY_ICONS[type]}
                  <span className="capitalize">{type}</span>
                  <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            // Show entities based on selected type
            <CommandGroup heading={`${selectedType}s`}>
              {filteredEntities.length === 0 ? (
                <CommandEmpty>No {selectedType}s found.</CommandEmpty>
              ) : (
                filteredEntities.map((entity, index) => (
                  <CommandItem
                    key={entity.id}
                    data-highlighted={highlightedIndex === index}
                    className={cn(
                      highlightedIndex === index && 'bg-accent',
                      'flex cursor-pointer items-center',
                    )}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={e => {
                      e.preventDefault()
                      onSelect(entity)
                    }}>
                    {ENTITY_ICONS[entity.type]}
                    <span className="truncate">{entity.name}</span>
                    {entity.parentId && (
                      <span className="ml-2 text-xs text-muted-foreground opacity-70">
                        ({entity.parentType === 'document' ? 'in document' : 'in'})
                      </span>
                    )}
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  )
}
