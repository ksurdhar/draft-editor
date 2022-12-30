import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, TextField, FormControl, MenuItem, Select, Box, IconButton } from '@mui/material'
import { useState } from 'react'
import { DocumentData } from '../types/globals'
import AddIcon from '@mui/icons-material/Add';

interface ShareModalProps {
  open: boolean
  onClose: () => void
  document: DocumentData
}

enum Permission {
  View = 'View',
  Comment = 'Comment',
  Edit = 'Edit'
}

interface ShareUser {
  email: string
  permission: Permission
}

const ShareModal = ({ open, onClose, document }: ShareModalProps) => {
  // needs to load people from the arrays
  // list them, their permissions
  // have the ability to click to remove
  // only makes api request on save

  const [ users, setUsers ] = useState<ShareUser[]>()
  const [ permission, setPermission ] = useState<Permission>(Permission.View)

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{`Share ${document.title}`}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          To subscribe to this website, please enter your email address here. We
          will send updates occasionally.
        </DialogContentText>
        <Box sx={{ display: 'flex', alignItems: 'center', padding: '16px' }}>
          <TextField
            label='Add email address'
            variant='outlined'
            margin='none'
            sx={{ 
              width: '300px', marginRight: '12px',
              '& input:focus': { boxShadow: 'none', outline: 'none' },
              '& input': { height: '40px' } 
            }}
          />
          <FormControl sx={{ marginRight: '12px' }}>
            <Select
              value={permission}
              onChange={(e) => setPermission(e.target.value as Permission)}
            >
              <MenuItem value={Permission.View}>Viewer</MenuItem>
              <MenuItem value={Permission.Comment}>Commenter</MenuItem>
              <MenuItem value={Permission.Edit}>Editor</MenuItem>
            </Select>
          </FormControl>
          <IconButton color="primary" aria-label="add to shopping cart">
            <AddIcon />
          </IconButton>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onClose}>Subscribe</Button>
      </DialogActions>
    </Dialog>
  )
}

export default ShareModal