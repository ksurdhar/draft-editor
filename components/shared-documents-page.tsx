'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { DocumentData } from '@typez/globals'
import { format } from 'date-fns'
import { useState, useRef, useEffect } from 'react'
import { useNavigation } from './providers'
import { TreeView, TreeItem } from '@mui/x-tree-view'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { IconButton, Menu, MenuItem } from '@mui/material'
import RenameModal from './rename-modal'
import DeleteModal from './delete-modal'

// Helper function to safely format dates
function formatDate(timestamp: number | undefined | null): string {
  if (!timestamp) return 'Never'
  try {
    return format(new Date(timestamp), 'MMM d, yyyy')
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
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const showSpinner = useSpinner(isLoading)
  const { navigateTo } = useNavigation()

  const selectedDoc = docs.find(doc => doc.id === selectedDocId)
  console.log('selected doc', JSON.stringify(selectedDoc, null, 2))

  useEffect(() => {
    if (editingDocId && editInputRef.current) {
      editInputRef.current.focus()
      const length = editInputRef.current.value.length
      editInputRef.current.setSelectionRange(length, length)
    }
  }, [editingDocId])

  const handleClick = (e: React.MouseEvent, doc: DocumentData) => {
    e.stopPropagation()
    
    if (clickTimeoutRef.current !== null) {
      // Double click occurred
      clearTimeout(clickTimeoutRef.current)
      clickTimeoutRef.current = null
      handleDoubleClick(e, doc)
    } else {
      // Set timeout for single click
      clickTimeoutRef.current = setTimeout(() => {
        clickTimeoutRef.current = null
        if (editingDocId !== doc.id) {
          navigateTo(`/documents/${doc.id}`)
        }
      }, 250) // 250ms delay
    }
  }

  const handleDoubleClick = (e: React.MouseEvent, doc: DocumentData) => {
    e.stopPropagation()
    setEditingDocId(doc.id)
    setEditingTitle(doc.title)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, docId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (editingTitle.trim() !== '') {
        renameDocument(docId, editingTitle)
        setEditingDocId(null)
      }
    } else if (e.key === 'Escape') {
      setEditingDocId(null)
    }
  }

  const handleEditBlur = (docId: string) => {
    if (editingTitle.trim() !== '') {
      renameDocument(docId, editingTitle)
    }
    setEditingDocId(null)
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
    setSelectedDoc(id)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleRename = () => {
    setRenameModalOpen(true)
    handleMenuClose()
  }

  const handleDelete = () => {
    setDeleteModalOpen(true)
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
      onClick={(e) => handleClick(e, doc)}
      label={
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center min-w-[200px]">
            {editingDocId === doc.id ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => handleEditKeyDown(e, doc.id)}
                onBlur={() => handleEditBlur(doc.id)}
                className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 uppercase text-black/[.70] w-full p-0 m-0 h-[24px] leading-[24px]"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span 
                className="uppercase text-black/[.70] block h-[24px] leading-[24px]"
              >
                {doc.title}
              </span>
            )}
          </div>
          <div className="flex items-center">
            <span className="mr-4 text-black/[.65] capitalize">{formatDate(doc.lastUpdated)}</span>
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
                  fontFamily: 'Mukta, sans-serif',
                  '& .MuiTreeItem-content': {
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'inherit',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.4) !important',
                    },
                  },
                  '& .MuiTreeItem-label': {
                    fontFamily: 'inherit',
                  },
                  '& .Mui-selected': {
                    backgroundColor: 'rgba(255, 255, 255, 0.15) !important',
                  },
                  '& .MuiTreeItem-root': {
                    '&:hover > .MuiTreeItem-content': {
                      backgroundColor: 'rgba(255, 255, 255, 0.4) !important',
                    },
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
        }}
        transitionDuration={250}
        slotProps={{
          paper: {
            style: {
              transformOrigin: 'top'
            }
          }
        }}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            backdropFilter: 'blur(10px)',
            fontFamily: 'Mukta, sans-serif',
            boxShadow: 'none',
            border: '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: '6px',
            elevation: 0,
            transition: 'opacity 150ms ease, transform 150ms ease',
          },
          '& .MuiMenuItem-root': {
            fontFamily: 'inherit',
            color: 'rgba(0, 0, 0, 0.7)',
            textTransform: 'uppercase',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.3)',
            },
          }
        }}>
        <MenuItem onClick={handleRename}>RENAME</MenuItem>
        <MenuItem onClick={handleDelete}>DELETE</MenuItem>
      </Menu>

      <RenameModal
        open={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false)
          setSelectedDoc(null)
        }}
        onConfirm={(newName) => {
          if (selectedDocId) {
            renameDocument(selectedDocId, newName)
          }
          setSelectedDoc(null)
        }}
        initialValue={selectedDoc?.title || ''}
      />

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setSelectedDoc(null)
        }}
        onConfirm={() => {
          if (selectedDocId) {
            deleteDocument(selectedDocId)
          }
          setSelectedDoc(null)
        }}
        documentTitle={selectedDoc?.title?.toUpperCase() || 'UNTITLED'}
      />
    </Layout>
  )
}

export default SharedDocumentsPage
