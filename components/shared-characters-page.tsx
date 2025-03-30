'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { useState, useEffect, useCallback } from 'react'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import {
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Typography,
} from '@mui/material'
import RenameModal from './rename-modal'
import DeleteModal from './delete-modal'
import { useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import { mutate } from 'swr'
import CharacterModal from '@components/character-modal'
import { useNavigation } from '@components/providers'
import { DocumentData } from '@typez/globals'
import { debugLog } from '@lib/debug-logger'

// Character type definition
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

const SharedCharactersPage = ({
  characters,
  isLoading: charactersLoading,
  onCharactersChange,
  documents,
  onDocumentsChange,
}: {
  characters: CharacterData[]
  isLoading?: boolean
  onCharactersChange: (characters: CharacterData[]) => void
  documents: DocumentData[]
  onDocumentsChange: (docs: DocumentData[]) => void
}) => {
  const { post, patch, destroy } = useAPI()
  const { user, isLoading: userLoading } = useUser()
  const { navigateTo } = useNavigation()
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [createCharacterModalOpen, setCreateCharacterModalOpen] = useState(false)
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null)
  const [initAnimate, setInitAnimate] = useState(false)

  // Wrap mutation functions in useCallback
  const mutateCharacters = useCallback(
    (updatedCharacters: CharacterData[] | ((current: CharacterData[]) => CharacterData[])) => {
      const newCharacters =
        typeof updatedCharacters === 'function' ? updatedCharacters(characters) : updatedCharacters
      onCharactersChange(newCharacters)
    },
    [characters, onCharactersChange],
  )

  // Add useEffect to log document titles when documents prop changes
  useEffect(() => {
    // Check if documents is an array before mapping
    const documentTitles = Array.isArray(documents)
      ? documents.map(doc => doc?.title || 'Untitled Document')
      : []
    debugLog('SharedCharactersPage: Received document titles', documentTitles)
  }, [documents])

  const combinedLoading = charactersLoading

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitAnimate(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleCreateCharacter = useCallback(
    async (characterData: Partial<CharacterData>) => {
      if (!user?.sub) {
        console.error('No user ID available for character creation')
        return null
      }

      try {
        console.log('Creating character with data:', characterData)

        const now = Date.now()
        // Create a complete character object with all required fields
        const characterToCreate = {
          name: characterData.name || 'Unnamed Character',
          motivation: characterData.motivation || '',
          description: characterData.description || '',
          traits: characterData.traits || [],
          relationships: characterData.relationships || [],
          userId: user.sub,
          lastUpdated: now,
          documentIds: [],
          isArchived: false,
        }

        console.log('Sending character data to API:', characterToCreate)

        const newCharacter = await post('/characters', characterToCreate)

        console.log('API response for character creation:', newCharacter)

        if (newCharacter && newCharacter._id) {
          console.log('Successfully created character with ID:', newCharacter._id)
          mutateCharacters(prev => [...(prev || []), newCharacter])
          return newCharacter
        } else {
          console.error('Created character is missing _id:', newCharacter)
          return null
        }
      } catch (error) {
        console.error('Error creating character:', error)
        return null
      }
    },
    [user?.sub, post, mutateCharacters],
  )

  const handleUpdateCharacter = useCallback(
    async (id: string, data: Partial<CharacterData>) => {
      try {
        const updatedCharacter = await patch(`/characters/${id}`, data)

        mutateCharacters(prev =>
          prev.map(char => (char._id === id ? { ...char, ...updatedCharacter } : char)),
        )

        return updatedCharacter
      } catch (error) {
        console.error('Error updating character:', error)
        return null
      }
    },
    [patch, mutateCharacters],
  )

  const handleDeleteCharacter = useCallback(
    async (id: string) => {
      try {
        await destroy(`/characters/${id}`)

        mutateCharacters(prev => prev.filter(char => char._id !== id))

        return true
      } catch (error) {
        console.error('Error deleting character:', error)
        return false
      }
    },
    [destroy, mutateCharacters],
  )

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
    setSelectedCharacterId(id)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleDelete = () => {
    setDeleteModalOpen(true)
    handleMenuClose()
  }

  const handleDeleteConfirm = async () => {
    if (!selectedCharacterId) return

    try {
      const success = await handleDeleteCharacter(selectedCharacterId)
      if (success) {
        setDeleteModalOpen(false)
        setSelectedCharacterId(null)
      }
    } catch (error) {
      console.error('Error in delete operation:', error)
    }
  }

  const handleMenuRename = () => {
    setRenameModalOpen(true)
    handleMenuClose()
  }

  const handleRename = async (id: string, newName: string) => {
    try {
      await handleUpdateCharacter(id, { name: newName })
      // Also update the individual character cache if it exists
      mutate(`/characters/${id}`)
    } catch (error) {
      console.error('Failed to rename character:', error)
    }
  }

  const handleCharacterClick = (id: string) => {
    console.log('Character Click - Navigating to:', `/characters/${id}`)
    navigateTo(`/characters/${id}`)
  }

  // Add keyboard shortcut for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedCharacterId) {
        e.preventDefault()
        setDeleteModalOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCharacterId])

  const showSpinner = useSpinner(combinedLoading || userLoading)

  const emptyMessage = (
    <div className={'text-center text-[14px] font-semibold uppercase text-black/[.5]'}>
      No characters yet. Create your first character to get started.
    </div>
  )

  const selectedCharacter = selectedCharacterId
    ? characters.find(char => char && char._id === selectedCharacterId)
    : null

  return (
    <Layout>
      <div className="gradient-editor fixed left-0 top-0 z-[-1] h-screen w-screen" />
      <div
        className={`gradient fixed left-0 top-0 z-[-1] h-screen w-screen transition-opacity duration-[3000ms] ease-in-out ${initAnimate ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] justify-center pb-10">
        <div className="flex w-11/12 max-w-[740px] flex-col justify-center sm:w-9/12">
          <div className="mb-4 flex justify-end gap-2">
            <div className="flex gap-0.5 rounded-lg bg-white/[.05]">
              <Tooltip title="Create new character">
                <IconButton
                  onClick={() => setCreateCharacterModalOpen(true)}
                  className="hover:bg-black/[.10]"
                  size="small">
                  <PersonAddIcon />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          <div className="max-h-[calc(100vh_-_100px)] overflow-y-auto rounded-lg bg-white/[.05] p-4">
            {showSpinner && <Loader />}
            {!combinedLoading && characters.length === 0 && emptyMessage}
            {!combinedLoading && characters.length > 0 && (
              <List>
                {characters
                  .filter(character => character !== null)
                  .map(character => (
                    <Paper
                      key={character._id}
                      elevation={0}
                      className="mb-3 overflow-hidden rounded-lg transition-all duration-200"
                      sx={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        },
                      }}>
                      <ListItem button onClick={() => handleCharacterClick(character._id)} className="py-3">
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" className="font-semibold">
                              {character.name}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" className="line-clamp-1 text-black/[.6]">
                              {character.description || 'No description'}
                            </Typography>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={e => handleMenuClick(e, character._id)}
                            size="small"
                            className="opacity-50 hover:opacity-100">
                            <MoreVertIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    </Paper>
                  ))}
              </List>
            )}
          </div>
        </div>
      </div>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transitionDuration={250}
        slotProps={{
          paper: {
            style: {
              transformOrigin: 'top',
            },
          },
        }}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)',
            fontFamily: 'Mukta, sans-serif',
            boxShadow: 'none',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '6px',
            elevation: 0,
            transition: 'opacity 150ms ease, transform 150ms ease',
          },
          '& .MuiMenuItem-root': {
            fontFamily: 'inherit',
            color: 'rgba(0, 0, 0, 0.7)',
            textTransform: 'uppercase',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
            },
          },
        }}>
        <MenuItem onClick={handleMenuRename}>RENAME</MenuItem>
        <MenuItem onClick={handleDelete}>DELETE</MenuItem>
      </Menu>

      <RenameModal
        open={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false)
          setSelectedCharacterId(null)
        }}
        onConfirm={newName => {
          if (selectedCharacterId) {
            handleRename(selectedCharacterId, newName)
          }
          setSelectedCharacterId(null)
          setRenameModalOpen(false)
        }}
        initialValue={selectedCharacter?.name || ''}
      />

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setSelectedCharacterId(null)
        }}
        onConfirm={handleDeleteConfirm}
        documentTitle={(selectedCharacter?.name || 'Unnamed Character').toUpperCase()}
        itemCount={1}
      />

      <CharacterModal
        open={createCharacterModalOpen}
        onClose={() => setCreateCharacterModalOpen(false)}
        onConfirm={handleCreateCharacter}
        initialData={null}
      />

      <CharacterModal
        open={!!editingCharacter}
        onClose={() => setEditingCharacter(null)}
        onConfirm={characterData => handleUpdateCharacter(characterData._id!, characterData)}
        initialData={editingCharacter}
      />
    </Layout>
  )
}

export default SharedCharactersPage
