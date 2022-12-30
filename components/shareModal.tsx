import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, TextField, FormControl, MenuItem, Select, Box, IconButton, Switch, FormGroup, FormControlLabel } from '@mui/material'
import { useState } from 'react'
import { DocumentData } from '../types/globals'
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { UserProfile } from '@auth0/nextjs-auth0';

interface ShareModalProps {
  open: boolean
  onClose: () => void
  document: DocumentData
  user: UserProfile
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

const ShareModal = ({ open, onClose, document, user }: ShareModalProps) => {
  const [ users, setUsers ] = useState<ShareUser[]>([])
  const [ permission, setPermission ] = useState(Permission.View)
  const [ globalPermission, setGlobalPermission ] = useState(Permission.View)

  const [ email, setEmail] = useState('')
  const [ isRestricted, setIsRestricted] = useState(true)

  return (
    <Dialog open={open} onClose={onClose}>
      <Box sx={{ minWidth: '576px' }}>
      <DialogTitle>{`Share ${document.title}`}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Add or remove users who have access to this document.
        </DialogContentText>
        <Box sx={{ padding: '16px'}}>
          <Box sx={{ marginBottom: '24px' }}>
            <FormControl sx={{ marginRight: '12px' }}>
              <Select
                sx={{ width: '192px' }}
                value={isRestricted}
                onChange={(e) => setIsRestricted(e.target.value === 'true')}
              >
                <MenuItem value={'true'}>Restricted</MenuItem>
                <MenuItem value={'false'}>Anyone with the link</MenuItem>
              </Select>
            </FormControl>
            { !isRestricted &&
            <FormControl sx={{ marginRight: '12px' }}>
              <Select
                value={globalPermission}
                onChange={(e) => setGlobalPermission(e.target.value as Permission)}
              >
                <MenuItem value={Permission.View}>Viewer</MenuItem>
                <MenuItem value={Permission.Comment}>Commenter</MenuItem>
                <MenuItem value={Permission.Edit}>Editor</MenuItem>
              </Select>
            </FormControl>
            }
          </Box>
          <Box sx={{ marginBottom: '12px', display: 'flex', alignItems: 'center'}}>
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