'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { DocumentData, FolderData } from '@typez/globals'
import { useState, useMemo, useEffect, useCallback } from 'react'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import RenameModal from './rename-modal'
import DeleteModal from './delete-modal'
import CreateFolderModal from './create-folder-modal'
import DocumentTree, { createTreeItems } from './document-tree'
import { useNavigation, useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import {
  moveItem,
  bulkDelete,
  createDocument,
  DocumentOperations,
  renameItem,
} from '@lib/document-operations'
import { mutate } from 'swr'

const SharedDocumentsPage = ({
  documents,
  folders,
  isLoading,
  onDocumentsChange,
  onFoldersChange,
}: {
  documents: DocumentData[]
  folders: FolderData[]
  isLoading?: boolean
  onDocumentsChange: (docs: DocumentData[]) => void
  onFoldersChange: (folders: FolderData[]) => void
}) => {
  const { navigateTo } = useNavigation()
  const { post, patch } = useAPI()
  const { user, isLoading: userLoading } = useUser()
  const [selectedDocId, setSelectedDoc] = useState<string | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [initAnimate, setInitAnimate] = useState(false)

  // Wrap mutation functions in useCallback
  const mutateDocs = useCallback(
    (updatedDocs: DocumentData[] | ((current: DocumentData[]) => DocumentData[])) => {
      const newDocs = typeof updatedDocs === 'function' ? updatedDocs(documents) : updatedDocs
      onDocumentsChange(newDocs)
    },
    [documents, onDocumentsChange],
  )

  const mutateFolders = useCallback(
    (updatedFolders: FolderData[] | ((current: FolderData[]) => FolderData[])) => {
      const newFolders = typeof updatedFolders === 'function' ? updatedFolders(folders) : updatedFolders
      onFoldersChange(newFolders)
    },
    [folders, onFoldersChange],
  )

  const docsLoading = isLoading
  const foldersLoading = isLoading

  const operations = useMemo<DocumentOperations>(
    () => ({
      patchDocument: (id: string, data: any) => patch(`documents/${id}`, data),
      patchFolder: (id: string, data: any) => patch(`folders/${id}`, data),
      bulkDeleteItems: (documentIds: string[], folderIds: string[]) =>
        post('documents/bulk-delete', { documentIds, folderIds }),
      createDocument: async (data: any) => {
        const response = await post('/documents', data)
        return response
      },
      renameItem: async (itemId, newName, docs, folders, ops, onUpdate) => {
        await renameItem(itemId, newName, docs, folders, ops, onUpdate)
      },
    }),
    [patch, post],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitAnimate(true)
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const handleMoveItem = useCallback(
    async (itemId: string, targetFolderId?: string, targetIndex?: number) => {
      try {
        await moveItem(
          itemId,
          targetFolderId,
          targetIndex,
          documents,
          folders,
          operations,
          (updatedDocs, updatedFolders) => {
            mutateDocs(updatedDocs)
            mutateFolders(updatedFolders)
          },
        )
      } catch (error) {
        console.error('Move failed:', error)
        // Revert on error by triggering revalidation
        mutateDocs(documents)
        mutateFolders(folders)
      }
    },
    [documents, folders, operations, mutateDocs, mutateFolders],
  )

  const handleBulkDelete = useCallback(
    async (documentIds: string[], folderIds: string[]) => {
      try {
        await bulkDelete(
          documentIds,
          folderIds,
          documents,
          folders,
          operations,
          (updatedDocs, updatedFolders) => {
            mutateDocs(updatedDocs)
            mutateFolders(updatedFolders)
          },
        )
      } catch (error) {
        // Revert on error
        mutateDocs(documents)
        mutateFolders(folders)
      }
    },
    [documents, folders, operations, mutateDocs, mutateFolders],
  )

  const handleRename = useCallback(
    async (itemId: string, newName: string) => {
      try {
        await renameItem(itemId, newName, documents, folders, operations, (updatedDocs, updatedFolders) => {
          mutateDocs(updatedDocs)
          mutateFolders(updatedFolders)
          // Also update the individual document cache if it exists
          mutate(`/documents/${itemId}`)
        })
      } catch (error) {
        console.error('Failed to rename item:', error)
        mutateDocs(documents)
        mutateFolders(folders)
      }
    },
    [documents, folders, operations, mutateDocs, mutateFolders],
  )

  const createFolder = useCallback(
    async (title: string) => {
      try {
        // Calculate the highest index from existing root-level items
        const rootItems = [
          ...documents.filter(doc => !doc.parentId || doc.parentId === 'root'),
          ...folders.filter(folder => !folder.parentId || folder.parentId === 'root'),
        ]
        const highestIndex = rootItems.reduce((max, item) => Math.max(max, item.folderIndex || 0), -1)
        const newIndex = highestIndex + 1

        const folderData = {
          title,
          parentId: 'root',
          userId: user?.sub || 'current',
          lastUpdated: Date.now(),
          folderIndex: newIndex,
        }

        const response = await post('folders', folderData)
        mutateFolders([...folders, response])
      } catch (error) {
        console.error('Error creating folder:', error)
        mutateFolders(folders)
      }
    },
    [folders, mutateFolders, post, user?.sub, documents],
  )

  const handleCreateDocument = useCallback(async () => {
    if (!user?.sub) return

    try {
      // Calculate the highest index from existing root-level documents
      const rootDocs = documents.filter(doc => !doc.parentId || doc.parentId === 'root')
      const highestIndex = rootDocs.reduce((max, doc) => Math.max(max, doc.folderIndex || 0), -1)
      const newIndex = highestIndex + 1

      await createDocument(
        user.sub,
        {
          ...operations,
          createDocument: async data => {
            const response = await post('/documents', {
              ...data,
              parentId: 'root',
              folderIndex: newIndex,
            })
            return response
          },
        },
        docId => {
          navigateTo(`/documents/${docId}?focus=title`)
        },
      )
    } catch (error) {
      console.error('Error creating document:', error)
    }
  }, [user?.sub, operations, navigateTo, documents, post])

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, id: string) => {
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
    setSelectedDoc(id)
    setSelectedItems([id])
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleDelete = () => {
    setDeleteModalOpen(true)
    handleMenuClose()
  }

  const handleDeleteConfirm = async () => {
    try {
      const items = createTreeItems(documents, folders)
      const selectedDocs = selectedItems.filter(id => !items[id]?.isFolder)
      const selectedFolders = selectedItems.filter(id => items[id]?.isFolder)

      // Validate that we have valid items to delete
      if (selectedDocs.length === 0 && selectedFolders.length === 0) {
        console.error('No valid items selected for deletion')
        return
      }

      // Store current state for potential rollback
      const prevDocs = [...documents]
      const prevFolders = [...folders]

      try {
        await handleBulkDelete(selectedDocs, selectedFolders)
        setDeleteModalOpen(false)
        setSelectedItems([])
      } catch (error: any) {
        // Revert to previous state
        mutateDocs(prevDocs)
        mutateFolders(prevFolders)

        // Show detailed error if available
        const errorMessage = error.response?.data?.details || error.message || 'Failed to delete items'
        console.error('Delete failed:', errorMessage)
      }
    } catch (error: any) {
      console.error('Error in delete operation:', error)
    }
  }

  // Add keyboard shortcut for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedItems.length > 0) {
        e.preventDefault()
        setDeleteModalOpen(true)
      }

      // Handle escape key
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setSelectedItems([])
      }

      // Let react-complex-tree handle arrow keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault() // Just prevent scroll
      }
    }

    window.addEventListener('keydown', handleKeyDown, true) // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedItems])

  const showSpinner = useSpinner(docsLoading || foldersLoading || userLoading)
  const items = useMemo(() => createTreeItems(documents, folders), [documents, folders])

  const emptyMessage = (
    <div className={'text-center text-[14px] font-semibold uppercase text-black/[.5]'}>
      Empty / Go create something of worth
    </div>
  )

  const handleMenuRename = () => {
    setRenameModalOpen(true)
    handleMenuClose()
  }

  return (
    <Layout>
      <div className="gradient-editor fixed left-0 top-0 z-[-1] h-screen w-screen" />
      <div
        className={`gradient duration-[3000ms] fixed left-0 top-0 z-[-1] h-screen w-screen transition-opacity ease-in-out ${initAnimate ? 'opacity-100' : 'opacity-0'}`}
      />
      <div className="relative top-[44px] flex h-[calc(100vh_-_80px)] justify-center pb-10">
        <div className="flex w-11/12 max-w-[740px] flex-col justify-center sm:w-9/12">
          <div className="mb-4 flex justify-end gap-2">
            <div className="flex gap-0.5 rounded-lg bg-white/[.05]">
              <Tooltip title="Create new document">
                <IconButton onClick={handleCreateDocument} className="hover:bg-black/[.10]" size="small">
                  <NoteAddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Create new folder">
                <IconButton
                  onClick={() => setCreateFolderModalOpen(true)}
                  className="hover:bg-black/[.10]"
                  size="small">
                  <CreateNewFolderIcon />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          <div className="max-h-[calc(100vh_-_100px)] overflow-y-auto rounded-lg bg-white/[.05] p-4">
            {showSpinner && <Loader />}
            {!docsLoading && !foldersLoading && !documents.length && !folders.length && emptyMessage}
            {!docsLoading && !foldersLoading && (documents.length || folders.length) && (
              <DocumentTree
                items={items}
                onPrimaryAction={item => navigateTo(`/documents/${item.index}`)}
                onMove={handleMoveItem}
                onRename={handleRename}
                showActionButton={true}
                onActionButtonClick={handleMenuClick}
                selectedItems={selectedItems}
                onSelectedItemsChange={items => setSelectedItems(items.map(i => i.toString()))}
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
              transformOrigin: 'top',
            },
          },
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
          },
        }}>
        <MenuItem onClick={handleMenuRename}>RENAME</MenuItem>
        <MenuItem onClick={handleDelete}>DELETE</MenuItem>
      </Menu>

      <RenameModal
        open={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false)
          setSelectedDoc(null)
        }}
        onConfirm={newName => {
          if (selectedDocId) {
            handleRename(selectedDocId, newName)
          }
          setSelectedDoc(null)
          setRenameModalOpen(false)
        }}
        initialValue={selectedDocId ? items[selectedDocId]?.data || '' : ''}
      />

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setSelectedDoc(null)
        }}
        onConfirm={handleDeleteConfirm}
        documentTitle={selectedItems.map(id => items[id]?.data.toUpperCase()).join(', ')}
        itemCount={selectedItems.length}
      />

      <CreateFolderModal
        open={createFolderModalOpen}
        onClose={() => setCreateFolderModalOpen(false)}
        onConfirm={folderName => {
          createFolder(folderName)
          setCreateFolderModalOpen(false)
        }}
      />
    </Layout>
  )
}

export default SharedDocumentsPage
