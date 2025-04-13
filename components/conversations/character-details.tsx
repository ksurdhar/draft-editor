'use client'

import React from 'react'
// Remove MUI imports not needed anymore
// import { Paper, Chip, Box, IconButton, Tooltip } from '@mui/material'
import { Typography } from '@mui/material' // Keep for text elements for now
// import EditIcon from '@mui/icons-material/Edit' // Edit button is handled differently
import { useNavigation } from '@components/providers'
// Import Shadcn Badge and Button
import { Badge } from '@components/ui/badge'
import { Button } from '@components/ui/button'

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
  onEditClick: () => void // Keep prop to trigger modal from parent sheet
}

const CharacterDetails: React.FC<CharacterDetailsProps> = ({ character, onEditClick }) => {
  const { navigateTo } = useNavigation()

  if (!character) {
    return null
  }

  return (
    // Remove Paper wrapper, component will render directly into SheetContent
    <div className="space-y-4">
      {/* Character Name is likely in SheetHeader, but keep details here */}
      {/* Removed Edit icon button, edit is triggered differently now */}

      <div>
        <Typography variant="subtitle1" className="font-semibold text-muted-foreground">
          Motivation:
        </Typography>
        <Typography variant="body1" className="text-foreground">
          {character.motivation || 'No motivation specified'}
        </Typography>
      </div>

      <div>
        <Typography variant="subtitle1" className="font-semibold text-muted-foreground">
          Description:
        </Typography>
        <Typography variant="body1" className="text-foreground">
          {character.description || 'No description available'}
        </Typography>
      </div>

      {character.traits && character.traits.length > 0 && (
        <div>
          <Typography variant="subtitle1" className="mb-2 font-semibold text-muted-foreground">
            Traits:
          </Typography>
          <div className="flex flex-wrap gap-1">
            {character.traits.map((trait, index) => (
              <Badge key={index} variant="secondary">
                {trait}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {character.documentIds && character.documentIds.length > 0 && (
        <div>
          <Typography variant="subtitle1" className="mb-2 font-semibold text-muted-foreground">
            Appears in:
          </Typography>
          <div className="flex flex-wrap gap-2">
            {character.documentIds.map((docId, index) => (
              <Badge
                key={docId}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => navigateTo(`/documents/${docId}`)}>
                {/* TODO: Fetch document titles if possible, maybe store on character? */}
                {`Document ${index + 1}`}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Add the Edit button here to trigger the modal via onEditClick */}
      <div className="mt-6 border-t pt-4">
        <Button onClick={onEditClick} variant="outline" size="sm">
          Edit Character Details
        </Button>
      </div>
      {/* Remove the old test button */}
      {/* <div className="mt-5"><Button>Test Shadcn Button</Button></div> */}
    </div>
  )
}

export default CharacterDetails
