import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, TextField, FormControl, MenuItem, Select, Box, IconButton } from '@mui/material'
import { useState } from 'react'
import { DocumentData } from '../types/globals'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import {  useUser } from '@auth0/nextjs-auth0'
import { updateDoc } from '../lib/httpUtils'
import useSWRMutation from 'swr/mutation'

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
  const { user } = useUser()
  const { trigger } = useSWRMutation(`/api/documents/${document.id}`, updateDoc)

  const initialUsers: ShareUser[] = []
  document.comment.forEach((email) => initialUsers.push({ email, permission: Permission.Comment }))
  document.edit.forEach((email) => initialUsers.push({ email, permission: Permission.Edit }))
  document.view.forEach((email) => initialUsers.push({ email, permission: Permission.View }))
  const [ users, setUsers ] = useState<ShareUser[]>(initialUsers.filter((usr) => user?.email !== usr.email))

  const [ isRestricted, setIsRestricted] = useState(document.view.length > 0)

  let initialGlobalPermission = Permission.Edit
  if (document.edit.length > 0 && document.comment.length === 0) {
    initialGlobalPermission = Permission.Comment
  }
  if (document.edit.length > 0 && document.comment.length > 0) {
    initialGlobalPermission = Permission.View
  }

  const [ globalPermission, setGlobalPermission ] = useState(initialGlobalPermission)
  const [ permission, setPermission ] = useState(Permission.View)
  const [ email, setEmail] = useState('')

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
          }
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Copy Link</Button>
        <Button onClick={async () => {

          const view: string[] = []
          const comment: string[] = []
          const edit: string[] = []

          if (isRestricted) {
            view.push(user.email as string)
            comment.push(user.email as string)
            edit.push(user.email as string)

            users.forEach((usr) => {
              switch (usr.permission) {
                case Permission.View: {
                  view.push(usr.email)
                  break
                }
                case Permission.Comment: {
                  comment.push(usr.email)
                  break
                }
                case Permission.Edit: {
                  edit.push(usr.email)
                  break
                }
              }
            })
          } else {
            switch (globalPermission) {
              case Permission.View: {
                edit.push(user.email as string)
                comment.push(user.email as string)
                break
              }
              case Permission.Comment: {
                edit.push(user.email as string)
                break
              }
              // Edit case requires empty array
            }
          }

          const updatedDoc: DocumentData = { 
            ...document,
            comment,
            edit,
            view,
          }

          // console.log('comment', comment)
          // console.log('edit', edit)
          // console.log('view', view)
          // console.log('________________')

          trigger(updatedDoc)

          onClose()
        }}>Done</Button>
      </DialogActions>
      </Box>
    </Dialog>
  )
}

export default ShareModal