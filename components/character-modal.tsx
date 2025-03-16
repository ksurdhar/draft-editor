import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Chip,
  Box,
  Typography,
  IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface CharacterData {
  name: string
  motivation: string
  description: string
  traits: string[]
}

interface CreateCharacterModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (characterData: CharacterData) => Promise<any>
}

const CreateCharacterModal = ({ open, onClose, onConfirm }: CreateCharacterModalProps) => {
  const [name, setName] = useState('John Doe')
  const [motivation, setMotivation] = useState('To find the truth about their past')
  const [description, setDescription] = useState('A determined character with a mysterious background')
  const [trait, setTrait] = useState('')
  const [traits, setTraits] = useState<string[]>(['brave', 'intelligent', 'resourceful'])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nameError, setNameError] = useState('')
  const [submitError, setSubmitError] = useState('')

  const resetForm = () => {
    setName('John Doe')
    setMotivation('To find the truth about their past')
    setDescription('A determined character with a mysterious background')
    setTrait('')
    setTraits(['brave', 'intelligent', 'resourceful'])
    setNameError('')
    setSubmitError('')
    setIsSubmitting(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleAddTrait = () => {
    if (trait.trim() && !traits.includes(trait.trim())) {
      setTraits([...traits, trait.trim()])
      setTrait('')
    }
  }

  const handleRemoveTrait = (traitToRemove: string) => {
    setTraits(traits.filter(t => t !== traitToRemove))
  }

  const handleTraitKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && trait.trim()) {
      e.preventDefault()
      handleAddTrait()
    }
  }

  const handleSubmit = async () => {
    // Validate name
    if (!name.trim()) {
      setNameError('Name is required')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      console.log('Submitting character data:', {
        name: name.trim(),
        motivation: motivation.trim(),
        description: description.trim(),
        traits,
      })

      const result = await onConfirm({
        name: name.trim(),
        motivation: motivation.trim(),
        description: description.trim(),
        traits,
      })

      console.log('Character creation result:', result)

      if (result) {
        handleClose()
      } else {
        setSubmitError('Failed to create character. Please try again.')
      }
    } catch (error) {
      console.error('Error creating character:', error)
      setSubmitError('An error occurred while creating the character.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        style: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
        },
      }}>
      <DialogTitle className="flex items-center justify-between">
        <Typography variant="h6" className="font-semibold">
          Create New Character
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box className="space-y-4 py-2">
          <TextField
            autoFocus
            label="Character Name"
            fullWidth
            value={name}
            onChange={e => {
              setName(e.target.value)
              if (e.target.value.trim()) setNameError('')
            }}
            error={!!nameError}
            helperText={nameError}
            variant="outlined"
            margin="dense"
          />

          <TextField
            label="Motivation"
            fullWidth
            value={motivation}
            onChange={e => setMotivation(e.target.value)}
            placeholder="What drives this character?"
            variant="outlined"
            margin="dense"
          />

          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description of the character"
            variant="outlined"
            margin="dense"
          />

          <Box>
            <TextField
              label="Character Traits"
              fullWidth
              value={trait}
              onChange={e => setTrait(e.target.value)}
              onKeyDown={handleTraitKeyDown}
              placeholder="Add traits and press Enter"
              variant="outlined"
              margin="dense"
              InputProps={{
                endAdornment: (
                  <Button onClick={handleAddTrait} disabled={!trait.trim()} variant="text" size="small">
                    Add
                  </Button>
                ),
              }}
            />

            <Box className="mt-2 flex flex-wrap gap-1">
              {traits.map((t, index) => (
                <Chip
                  key={index}
                  label={t}
                  onDelete={() => handleRemoveTrait(t)}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
          </Box>

          {submitError && (
            <Typography color="error" variant="body2" className="mt-2">
              {submitError}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions className="p-4">
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={!name.trim() || isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Character'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreateCharacterModal
export type { CharacterData }
