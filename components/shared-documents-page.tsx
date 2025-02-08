'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { DocumentData } from '@typez/globals'
import { format } from 'date-fns'
import { useState } from 'react'
import { useNavigation } from './providers'
import { TreeView, TreeItem } from '@mui/x-tree-view'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { IconButton, Menu, MenuItem } from '@mui/material'

// Helper function to safely format dates
function formatDate(timestamp: number | undefined | null): string {
  if (!timestamp) return 'Never'
  try {
    return format(new Date(timestamp), 'PP')
  } catch (error) {
    console.error('Error formatting date:', error)
    return 'Invalid date'
  }
}

export interface SharedDocumentsPageProps {
  docs: DocumentData[]
  isLoading: boolean
  deleteDocument: (id: string) => void
  renameDocument: (id: string, title: string) => void
}

const SharedDocumentsPage = ({
  docs,
  isLoading,
  deleteDocument,
  renameDocument,
}: SharedDocumentsPageProps) => {
  const [selectedDocId, setSelectedDoc] = useState<string | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [renameActive, setRenameActive] = useState(false)
  const [newName, setNewName] = useState('')
  const showSpinner = useSpinner(isLoading)
  const { navigateTo } = useNavigation()

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
    setSelectedDoc(id)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedDoc(null)
  }

  const handleRename = () => {
    setRenameActive(true)
    handleMenuClose()
  }

  const handleDelete = () => {
    if (selectedDocId) {
      deleteDocument(selectedDocId)
    }
    handleMenuClose()
  }

  const emptyMessage = (
    <div className={'text-center text-[14px] font-semibold uppercase text-black/[.5]'}>
      Empty / Go create something of worth
    </div>
  )

  const renderTree = (doc: DocumentData) => (
    <TreeItem
      key={doc.id}
      nodeId={doc.id}
      onClick={() => navigateTo(`/documents/${doc.id}`)}
      label={
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center">
            {renameActive && selectedDocId === doc.id ? (
              <form
                onSubmit={e => {
                  e.preventDefault()
                  if (selectedDocId) {
                    renameDocument(selectedDocId, newName)
                  }
                  setRenameActive(false)
                }}>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onBlur={() => setRenameActive(false)}
                  className="bg-transparent px-2 font-semibold uppercase"
                  placeholder="New Title"
                />
              </form>
            ) : (
              <span className="font-semibold uppercase">{doc.title}</span>
            )}
          </div>
          <div className="flex items-center">
            <span className="mr-4 text-black/[.65]">{formatDate(doc.lastUpdated)}</span>
            <IconButton
              size="small"
              onClick={e => handleMenuClick(e, doc.id)}
              className="hover:bg-black/[.10]">
              <MoreHorizIcon fontSize="small" />
            </IconButton>
          </div>
        </div>
      }
    />
  )

  return (
    <Layout>
      <div className="gradient absolute left-0 top-0 z-[-1] h-screen w-screen" />
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] justify-center pb-10">
        <div className="flex w-11/12 max-w-[740px] flex-col justify-center sm:w-9/12">
          <div className="max-h-[calc(100vh_-_100px)] overflow-y-auto rounded-lg bg-white/[.05] p-4">
            {showSpinner && <Loader />}
            {!isLoading && docs.length === 0 && emptyMessage}
            {docs.length > 0 && (
              <TreeView
                defaultCollapseIcon={<ExpandMoreIcon />}
                defaultExpandIcon={<ChevronRightIcon />}
                sx={{
                  '& .MuiTreeItem-content': {
                    padding: '4px 8px',
                    borderRadius: '4px',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  },
                  '& .Mui-selected': {
                    backgroundColor: 'rgba(255, 255, 255, 0.15) !important',
                  },
                }}>
                {docs.map(doc => renderTree(doc))}
              </TreeView>
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
        }}>
        <MenuItem onClick={handleRename}>Rename</MenuItem>
        <MenuItem onClick={handleDelete} className="text-red-500">
          Delete
        </MenuItem>
      </Menu>
    </Layout>
  )
}

export default SharedDocumentsPage
