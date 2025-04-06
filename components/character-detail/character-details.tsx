'use client'

import React from 'react'
import { Paper, Typography, Chip, Box, IconButton, Tooltip } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { useNavigation } from '@components/providers' // Keep navigation if needed for doc links
import { Button } from '@components/ui/button' // Correct import based on components.json

// Minimal necessary CharacterData definition for props
interface CharacterData {
  _id?: string
  name: string
  motivation: string
  description: string
  traits: string[]
  documentIds?: string[]
}

interface CharacterDetailsProps {
  character: CharacterData | null
  onEditClick: () => void
}

const CharacterDetails: React.FC<CharacterDetailsProps> = ({ character, onEditClick }) => {
  const { navigateTo } = useNavigation()

  if (!character) {
    // Optionally handle the null character case here, though the parent likely handles it
    return null
  }

  return (
    <Paper
      elevation={0}
      className="sticky top-[54px] overflow-hidden rounded-lg p-5"
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        height: 'fit-content',
        maxHeight: 'calc(100vh - 120px)', // Adjust based on parent layout if needed
        overflowY: 'auto',
      }}>
      <div className="mb-4 flex items-center justify-between">
        <Typography variant="h4" className="font-bold">
          {character.name}
        </Typography>
        <Tooltip title="Edit Character">
          <IconButton onClick={onEditClick} size="small">
            <EditIcon />
          </IconButton>
        </Tooltip>
      </div>

      <Typography variant="subtitle1" className="mb-4 text-black/[.7]">
        <span className="font-semibold">Motivation:</span> {character.motivation || 'No motivation specified'}
      </Typography>

      <Typography variant="body1" className="mb-5 text-black/[.8]">
        {character.description || 'No description available'}
      </Typography>

      {character.traits && character.traits.length > 0 && (
        <Box className="mb-5">
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

      {/* Document links - Keep navigation logic here if tied to this component */}
      {character.documentIds && character.documentIds.length > 0 && (
        <Box>
          <Typography variant="subtitle2" className="mb-2 font-semibold">
            Appears in:
          </Typography>
          <div className="flex flex-wrap gap-2">
            {character.documentIds.map((docId, index) => (
              // Find a better way to get document titles later if possible
              <Chip
                key={docId} // Use docId for key
                label={`Document ${index + 1}`} // Placeholder label
                size="small"
                color="secondary"
                variant="outlined"
                onClick={() => navigateTo(`/documents/${docId}`)}
                sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', cursor: 'pointer' }}
              />
            ))}
          </div>
        </Box>
      )}

      {/* Add the button here */}
      <div className="mt-5">
        <Button>Test Shadcn Button</Button>
      </div>
    </Paper>
  )
}

export default CharacterDetails
