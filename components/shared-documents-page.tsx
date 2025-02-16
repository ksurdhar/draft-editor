'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { DocumentData, FolderData } from '@typez/globals'
import { useState, useMemo, useEffect } from 'react'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import RenameModal from './rename-modal'
import DeleteModal from './delete-modal'
import CreateFolderModal from './create-folder-modal'
import { TreeItem, TreeItemIndex } from 'react-complex-tree'
import { useNavigation, useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import DocumentTree, { createTreeItems } from './document-tree'

export interface SharedDocumentsPageProps {
  docs: DocumentData[]
  folders: FolderData[]
  isLoading: boolean
  renameDocument: (id: string, title: string) => void
  createFolder: (title: string, parentId?: string) => void
  renameFolder: (id: string, title: string) => void
  onMove?: (itemId: string, targetFolderId?: string, dropIndex?: number) => Promise<void>
  bulkDelete: (documentIds: string[], folderIds: string[]) => Promise<void>
  onCreateDocument?: () => Promise<void>
}

const SharedDocumentsPage = ({
  docs = [],
  folders = [],
  isLoading,
  renameDocument,
  createFolder,
  renameFolder,
  onMove,
  bulkDelete,
  onCreateDocument,
}: SharedDocumentsPageProps) => {
  const { navigateTo } = useNavigation()
  const { post } = useAPI()
  const { user } = useUser()
  const [selectedDocId, setSelectedDoc] = useState<string | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false)
  const showSpinner = useSpinner(isLoading)
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>()
  const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([])
  const [initAnimate, setInitAnimate] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitAnimate(true)
    }, 50)

    return () => clearTimeout(timer)
  }, [])

  // Handle URL changes
  useEffect(() => {
    const handleRouteChange = () => {
      setInitAnimate(false)
    }

    window.addEventListener('popstate', handleRouteChange)
    return () => window.removeEventListener('popstate', handleRouteChange)
  }, [])

  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if we're in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      // Don't handle shortcuts if any modal is open
      if (deleteModalOpen || renameModalOpen || createFolderModalOpen) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        if (selectedItems.length > 0) {
          setDeleteModalOpen(true)
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        if (selectedItems.length > 0) {
          setDeleteModalOpen(true)
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setSelectedItems([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItems, deleteModalOpen, renameModalOpen, createFolderModalOpen])

  const items = useMemo(() => createTreeItems(docs, folders), [docs, folders])

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
    setSelectedDoc(id)
    setSelectedItems([id])
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

  const handleDeleteConfirm = async () => {
    try {
      const selectedDocs = selectedItems.map(id => id.toString()).filter(id => !items[id]?.isFolder)
      const selectedFolders = selectedItems.map(id => id.toString()).filter(id => items[id]?.isFolder)

      await bulkDelete(selectedDocs, selectedFolders)
      setDeleteModalOpen(false)
      setSelectedItems([])
    } catch (error) {
      console.error('Error deleting items:', error)
    }
  }

  const handleCreateFolder = () => {
    setCreateFolderModalOpen(true)
  }

  const handleCollapseAll = () => {
    // This will be handled by the tree component internally
  }

  const handleExpandAll = () => {
    // This will be handled by the tree component internally
  }

  const handleCreateDocument = async () => {
    if (!onCreateDocument) {
      console.error('No document creation handler provided')
      return
    }
    await onCreateDocument()
  }

  const handlePrimaryAction = (item: TreeItem) => {
    const selectedId = item.index.toString()
    if (!selectedId || !items[selectedId]) return

    const treeItem = items[selectedId]
    if (!treeItem.isFolder) {
      navigateTo(`/documents/${selectedId}`)
    } else {
      setNewFolderParentId(selectedId)
    }
  }

  const handleSelectedItemsChange = (items: TreeItemIndex[]) => {
    setSelectedItems(items)
  }

  const emptyMessage = (
    <div className={'text-center text-[14px] font-semibold uppercase text-black/[.5]'}>
      Empty / Go create something of worth
    </div>
  )

  return (
    <Layout>
      <div className="gradient-editor fixed top-0 left-0 h-screen w-screen z-[-1]" />
      <div className={`gradient fixed top-0 left-0 h-screen w-screen z-[-1] transition-opacity ease-in-out duration-[3000ms] ${initAnimate ? 'opacity-100' : 'opacity-0'}`} />
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] justify-center pb-10">
        <div className="flex w-11/12 max-w-[740px] flex-col justify-center sm:w-9/12">
          <div className="flex justify-end mb-4 gap-2">
            <div className="flex gap-0.5 bg-white/[.05] rounded-lg">
              <Tooltip title="Collapse all">
                <IconButton
                  onClick={handleCollapseAll}
                  className="hover:bg-black/[.10]"
                  size="small"
                >
                  <ExpandLessIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Expand all">
                <IconButton
                  onClick={handleExpandAll}
                  className="hover:bg-black/[.10]"
                  size="small"
                >
                  <ExpandMoreIcon />
                </IconButton>
              </Tooltip>
            </div>
            <div className="flex gap-0.5 bg-white/[.05] rounded-lg">
              <Tooltip title="Create new document">
                <IconButton
                  onClick={handleCreateDocument}
                  className="hover:bg-black/[.10]"
                  size="small"
                >
                  <NoteAddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Create new folder">
                <IconButton
                  onClick={handleCreateFolder}
                  className="hover:bg-black/[.10]"
                  size="small"
                >
                  <CreateNewFolderIcon />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          <div className="max-h-[calc(100vh_-_100px)] overflow-y-auto rounded-lg bg-white/[.05] p-4">
            {showSpinner && <Loader />}
            {!isLoading && (!docs?.length && !folders?.length) && emptyMessage}
            {(!isLoading && (docs?.length > 0 || folders?.length > 0)) && (
              <DocumentTree
                items={items}
                onPrimaryAction={handlePrimaryAction}
                onMove={onMove}
                showActionButton={true}
                onActionButtonClick={handleMenuClick}
                selectedItems={selectedItems}
                onSelectedItemsChange={handleSelectedItemsChange}
              />
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
            const item = items[selectedDocId]
            if (item) {
              if (item.isFolder) {
                renameFolder(selectedDocId, newName)
              } else {
                renameDocument(selectedDocId, newName)
              }
            }
          }
          setSelectedDoc(null)
        }}
        initialValue={selectedDocId ? (items[selectedDocId]?.data || '') : ''}
      />

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setSelectedDoc(null)
        }}
        onConfirm={handleDeleteConfirm}
        documentTitle={selectedItems.map(id => items[id.toString()]?.data.toUpperCase()).join(', ')}
        itemCount={selectedItems.length}
      />

      <CreateFolderModal
        open={createFolderModalOpen}
        onClose={() => setCreateFolderModalOpen(false)}
        onConfirm={(folderName) => {
          createFolder(folderName, newFolderParentId)
          setCreateFolderModalOpen(false)
        }}
      />
    </Layout>
  )
}

export default SharedDocumentsPage
