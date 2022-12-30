import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, TextField, FormControl, MenuItem, Select, Box, IconButton } from '@mui/material'
import { useState } from 'react'
import { DocumentData } from '../types/globals'
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

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

  const [ users, setUsers ] = useState<ShareUser[]>([])
  const [ permission, setPermission ] = useState<Permission>(Permission.View)
  const [ email, setEmail] = useState<string>('')

  return (
    <Dialog open={open} onClose={onClose}>
      <Box sx={{ minWidth: '576px' }}>
      <DialogTitle>{`Share ${document.title}`}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Add or remove users who have access to this document.
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <FormControl sx={{ marginRight: '12px' }}>
            <Select
              sx={{ width: '131px' }}
              value={permission}
              onChange={(e) => setPermission(e.target.value as Permission)}
            >
              <MenuItem value={Permission.View}>Viewer</MenuItem>
              <MenuItem value={Permission.Comment}>Commenter</MenuItem>
              <MenuItem value={Permission.Edit}>Editor</MenuItem>
            </Select>
          </FormControl>
          <IconButton 
            onClick={() => {
              setUsers(users.concat([{ email, permission }]))
            }}
            color="primary">
            <AddIcon />
          </IconButton>
        </Box>
        <Box>
          { users.map((user) => {
            return (
              <Box key={user.email}>
                <span className='mr-4'>{user.email}</span>
                <span className='mr-4'>{user.permission}</span>
                <IconButton 
                  onClick={() => {
                    setUsers(users.filter((usr) => usr !== user))
                  }}
                  color="error">
                  <RemoveIcon />
                </IconButton>
              </Box>
            )
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Copy Link</Button>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
      </Box>
    </Dialog>
  )
}

export default ShareModal