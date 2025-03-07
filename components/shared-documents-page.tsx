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
import { moveItem, bulkDelete, createDocument, DocumentOperations } from '@lib/document-operations'
import { mutate } from 'swr'


const SharedDocumentsPage = ({
  documents,
  folders,
  isLoading,
  onDocumentsChange,
  onFoldersChange
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
  const [newFolderParentId] = useState<string | undefined>()
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [initAnimate, setInitAnimate] = useState(false)

  // Wrap mutation functions in useCallback
  const mutateDocs = useCallback((updatedDocs: DocumentData[] | ((current: DocumentData[]) => DocumentData[])) => {
    const newDocs = typeof updatedDocs === 'function' ? updatedDocs(documents) : updatedDocs
    onDocumentsChange(newDocs)
  }, [documents, onDocumentsChange])
  
  const mutateFolders = useCallback((updatedFolders: FolderData[] | ((current: FolderData[]) => FolderData[])) => {
    const newFolders = typeof updatedFolders === 'function' ? updatedFolders(folders) : updatedFolders
    onFoldersChange(newFolders)
  }, [folders, onFoldersChange])

  const docsLoading = isLoading
  const foldersLoading = isLoading

  const operations = useMemo<DocumentOperations>(() => ({
    patchDocument: (id: string, data: any) => patch(`documents/${id}`, data),
    patchFolder: (id: string, data: any) => patch(`folders/${id}`, data),
    bulkDeleteItems: (documentIds: string[], folderIds: string[]) => 
      post('documents/bulk-delete', { documentIds, folderIds }),
    createDocument: async (data: any) => {
      const response = await post('/documents', data)
      return response
    }
  }), [patch, post])

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
          }
        )
      } catch (error) {
        console.error('Move failed:', error)
        // Revert on error by triggering revalidation
        mutateDocs(documents)
        mutateFolders(folders)
      }
    },
    [documents, folders, operations, mutateDocs, mutateFolders]
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
          }
        )
      } catch (error) {
        // Revert on error
        mutateDocs(documents)
        mutateFolders(folders)
      }
    },
    [documents, folders, operations, mutateDocs, mutateFolders]
  )

  const renameDocument = useCallback(
    async (id: string, title: string) => {
      // Update list view immediately
      const updatedDocs = documents.map(doc => (doc._id === id ? { ...doc, title } : doc))
      mutateDocs(updatedDocs)

      try {
        // Update the document
        const updatedDoc = await operations.patchDocument(id, {
          title,
          lastUpdated: Date.now(),
        })

        // Update both the list and individual document cache
        await Promise.all([
          // Revalidate the documents list
          mutateDocs(current => 
            current?.map(doc => doc._id === id ? { ...doc, title } : doc)
          ),
          // Update/revalidate the individual document cache
          mutate(`/documents/${id}`, { ...updatedDoc, title })
        ])
      } catch (e) {
        console.log(e)
        mutateDocs(documents)
      }
    },
    [mutateDocs, documents, operations],
  )

  const createFolder = useCallback(
    async (title: string, parentId?: string) => {
      try {
        const folderData = {
          title,
          parentId: parentId || 'root',
          userId: user?.sub || 'current',
          lastUpdated: Date.now(),
          folderIndex: folders.length
        }

        const response = await post('folders', folderData)
        mutateFolders([...folders, response])
      } catch (error) {
        console.error('Error creating folder:', error)
        mutateFolders(folders)
      }
    },
    [folders, mutateFolders, post, user?.sub]
  )

  const renameFolder = useCallback(
    async (id: string, title: string) => {
      try {
        const response = await operations.patchFolder(id, {
          title,
          lastUpdated: Date.now()
        })
        mutateFolders(folders.map(folder => folder._id === id ? response : folder))
      } catch (error) {
        console.error('Error renaming folder:', error)
        mutateFolders(folders)
      }
    },
    [folders, operations, mutateFolders]
  )

  const handleCreateDocument = useCallback(async () => {
    if (!user?.sub) return
    
    try {
      await createDocument(
        user.sub,
        operations,
        (docId) => {
          navigateTo(`/documents/${docId}?focus=title`)
        }
      )
    } catch (error) {
      console.error('Error creating document:', error)
    }
  }, [user?.sub, operations, navigateTo])

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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItems])

  const showSpinner = useSpinner(docsLoading || foldersLoading || userLoading)
  const items = useMemo(() => createTreeItems(documents, folders), [documents, folders])

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
                  onClick={() => setCreateFolderModalOpen(true)}
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
            {!docsLoading && !foldersLoading && (!documents.length && !folders.length) && emptyMessage}
            {(!docsLoading && !foldersLoading && (documents.length || folders.length)) && (
              <DocumentTree
                items={items}
                onPrimaryAction={item => navigateTo(`/documents/${item.index}`)}
                onMove={handleMoveItem}
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
        documentTitle={selectedItems.map(id => items[id]?.data.toUpperCase()).join(', ')}
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
