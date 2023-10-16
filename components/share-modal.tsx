import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, IconButton, MenuItem, Select, TextField } from '@mui/material'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { fetcher, updateDoc } from '../lib/http-utils'
import { useUser } from '../mocks/auth-wrapper'
import { DocumentData, PermissionData, ShareUser, UserPermission } from '../types/globals'

interface ShareModalProps {
  open: boolean
  onClose: () => void
  document: DocumentData
}

const ShareModal = ({ open, onClose, document }: ShareModalProps) => {
  const { user } = useUser()
  const { trigger } = useSWRMutation(`/api/permissions/${document.id}`, updateDoc)
  const { data: permissions, isLoading } = useSWR<PermissionData, Error>(`/api/permissions/${document.id}`, fetcher) 

  const [ users, setUsers ] = useState<ShareUser[]>([])
  const [ isRestricted, setIsRestricted ] = useState(true)
  const [ globalPermission, setGlobalPermission ] = useState(UserPermission.None)
  const [ permission, setPermission ] = useState(UserPermission.View)
  const [ email, setEmail] = useState('')

  useEffect(() => {
    if (!permissions) return
    setUsers(permissions.users)
    setGlobalPermission(permissions.globalPermission)
    setIsRestricted(permissions.globalPermission === UserPermission.None)
  }, [isLoading, permissions])

  if (!user) return <></>

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
                onChange={(e) => {
                  const selection = e.target.value
                  if (selection === 'true') {
                    setIsRestricted(true)
                    setGlobalPermission(UserPermission.None)
                  } else {
                    setIsRestricted(false)
                    setGlobalPermission(UserPermission.View)
                  }
                }}
              >
                <MenuItem value={'true'}>Restricted</MenuItem>
                <MenuItem value={'false'}>Anyone with the link</MenuItem>
              </Select>
            </FormControl>

            { !isRestricted &&
            <FormControl sx={{ marginRight: '12px' }}>
              <Select
                value={globalPermission}
                onChange={(e) => setGlobalPermission(e.target.value as UserPermission)}
              >
                <MenuItem value={UserPermission.View}>Viewer</MenuItem>
                <MenuItem value={UserPermission.Comment}>Commenter</MenuItem>
                <MenuItem value={UserPermission.Edit}>Editor</MenuItem>
              </Select>
            </FormControl>
            }
          </Box>
          { isRestricted &&
             <Box>
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
                    sx={{ width: '131px' }}
                    value={permission}
                    onChange={(e) => setPermission(e.target.value as UserPermission)}
                  >
                   <MenuItem value={UserPermission.View}>Viewer</MenuItem>
                   <MenuItem value={UserPermission.Comment}>Commenter</MenuItem>
                   <MenuItem value={UserPermission.Edit}>Editor</MenuItem>
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
          }
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Copy Link</Button>
        <Button onClick={async () => {
          trigger({ globalPermission, users })
          onClose()
        }}>Done</Button>
      </DialogActions>
      </Box>
    </Dialog>
  )
}

export default ShareModal