'use client'

import { useState, useEffect } from 'react'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import { Paper, Typography, Chip, Box, IconButton, Tooltip, TextField, Button } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import CharacterModal from '@components/character-modal'

// Character type definition from character-modal.tsx
interface CharacterData {
  _id?: string
  name: string
  motivation: string
  description: string
  traits: string[]
  // Extended properties for our component
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

// Dialogue type definition
interface DialogueEntry {
  id: string
  content: string
  context: string
  timestamp: number
}

const CharacterDetailPage = ({
  character,
  isLoading,
  onCharacterChange,
}: {
  character: CharacterData | null
  isLoading?: boolean
  onCharacterChange: (character: CharacterData) => void
}) => {
  const { patch } = useAPI()
  const { isLoading: userLoading } = useUser()
  const [editingCharacter, setEditingCharacter] = useState<CharacterData | null>(null)
  const [dialogueEntries, setDialogueEntries] = useState<DialogueEntry[]>([
    {
      id: '1',
      content: "I don't understand why you would do such a thing. After all we've been through.",
      context: 'Confronting the antagonist',
      timestamp: Date.now() - 86400000, // 1 day ago
    },
    {
      id: '2',
      content: "There's more to this story than meets the eye. Trust me, I'm doing this for all of us.",
      context: 'Explaining motives',
      timestamp: Date.now() - 43200000, // 12 hours ago
    },
    {
      id: '3',
      content: "Sometimes the hardest choices require the strongest wills. I didn't want it to be this way.",
      context: 'Philosophical moment',
      timestamp: Date.now() - 3600000, // 1 hour ago
    },
  ])
  const [newDialogue, setNewDialogue] = useState('')
  const [newContext, setNewContext] = useState('')
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
      return updatedCharacter
    } catch (error) {
      console.error('Error updating character:', error)
      return null
    }
  }

  const handleAddDialogue = () => {
    if (!newDialogue.trim()) return

    const newEntry: DialogueEntry = {
      id: Date.now().toString(),
      content: newDialogue,
      context: newContext || 'General dialogue',
      timestamp: Date.now(),
    }

    setDialogueEntries([...dialogueEntries, newEntry])
    setNewDialogue('')
    setNewContext('')
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const showSpinner = useSpinner(isLoading || userLoading)

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
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] justify-center pb-10">
        <div className="flex w-11/12 max-w-[740px] flex-col justify-center sm:w-9/12">
          {/* Character Header */}
          <Paper
            elevation={0}
            className="mb-6 overflow-hidden rounded-lg p-6"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}>
            <div className="flex items-center justify-between">
              <Typography variant="h4" className="font-bold">
                {character.name}
              </Typography>
              <Tooltip title="Edit Character">
                <IconButton onClick={() => setEditingCharacter(character)} size="small">
                  <EditIcon />
                </IconButton>
              </Tooltip>
            </div>

            <Typography variant="subtitle1" className="mt-2 text-black/[.7]">
              <span className="font-semibold">Motivation:</span>{' '}
              {character.motivation || 'No motivation specified'}
            </Typography>

            <Typography variant="body1" className="mt-4 text-black/[.8]">
              {character.description || 'No description available'}
            </Typography>

            {character.traits && character.traits.length > 0 && (
              <Box className="mt-4">
                <Typography variant="subtitle2" className="mb-2 font-semibold">
                  Traits:
                </Typography>
                <div className="flex flex-wrap gap-1">
                  {character.traits.map((trait, index) => (
                    <Chip
                      key={index}
                      label={trait}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                    />
                  ))}
                </div>
              </Box>
            )}
          </Paper>

          {/* Dialogue Section */}
          <Typography variant="h5" className="mb-4 font-semibold">
            Character Dialogue
          </Typography>

          {/* Add New Dialogue */}
          <Paper
            elevation={0}
            className="mb-6 overflow-hidden rounded-lg p-4"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
            }}>
            <Typography variant="subtitle2" className="mb-2 font-semibold">
              Add New Dialogue
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Enter character dialogue..."
              value={newDialogue}
              onChange={e => setNewDialogue(e.target.value)}
              variant="outlined"
              margin="dense"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            />
            <TextField
              fullWidth
              placeholder="Context (optional)"
              value={newContext}
              onChange={e => setNewContext(e.target.value)}
              variant="outlined"
              margin="dense"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleAddDialogue}
              disabled={!newDialogue.trim()}
              className="mt-2">
              Add Dialogue
            </Button>
          </Paper>

          {/* Dialogue Entries */}
          <div className="max-h-[calc(100vh_-_400px)] overflow-y-auto">
            {dialogueEntries.length === 0 ? (
              <Typography variant="body2" className="text-center text-black/[.6]">
                No dialogue entries yet
              </Typography>
            ) : (
              dialogueEntries.map(entry => (
                <Paper
                  key={entry.id}
                  elevation={0}
                  className="mb-4 overflow-hidden rounded-lg p-4"
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    },
                  }}>
                  <div className="flex justify-between">
                    <Typography variant="caption" className="text-black/[.5]">
                      {entry.context}
                    </Typography>
                    <Typography variant="caption" className="text-black/[.5]">
                      {formatDate(entry.timestamp)}
                    </Typography>
                  </div>
                  <Typography variant="body1" className="mt-2 italic">
                    &ldquo;{entry.content}&rdquo;
                  </Typography>
                </Paper>
              ))
            )}
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

export default CharacterDetailPage
