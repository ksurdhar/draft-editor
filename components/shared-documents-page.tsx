'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { DocumentData, FolderData } from '@typez/globals'
import { useState, useMemo, useEffect } from 'react'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import RenameModal from './rename-modal'
import DeleteModal from './delete-modal'
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, TreeItemIndex, TreeItem, DraggingPosition } from 'react-complex-tree'
import 'react-complex-tree/lib/style.css'

export interface SharedDocumentsPageProps {
  docs: DocumentData[]
  folders: FolderData[]
  isLoading: boolean
  deleteDocument: (id: string) => void
  renameDocument: (id: string, title: string) => void
  createFolder: (title: string, parentId?: string) => void
  deleteFolder: (id: string) => void
  renameFolder: (id: string, title: string) => void
}

const SharedDocumentsPage = ({
  docs = [],
  folders = [],
  isLoading,
  deleteDocument,
  renameDocument,
  createFolder,
  deleteFolder,
  renameFolder,
}: SharedDocumentsPageProps) => {
  const [selectedDocId, setSelectedDoc] = useState<string | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const showSpinner = useSpinner(isLoading)
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>()

  const items = useMemo(() => {
    const treeItems: Record<string, any> = {
      root: {
        index: 'root',
        canMove: false,
        canRename: false,
        isFolder: true,
        children: [],
        data: 'Root'
      }
    }

    // Add folders first
    folders.forEach(folder => {
      const folderId = folder._id
      treeItems[folderId] = {
        index: folderId,
        canMove: true,
        canRename: true,
        isFolder: true,
        children: [],
        data: folder.title
      }
    })

    // Add documents
    docs.forEach(doc => {
      const docId = doc._id
      treeItems[docId] = {
        index: docId,
        canMove: true,
        canRename: true,
        isFolder: false,
        data: doc.title
      }
    })

    // Build tree structure
    folders.forEach(folder => {
      const folderId = folder._id
      const parentId = folder.parentId || 'root'
      if (treeItems[parentId]) {
        treeItems[parentId].children.push(folderId)
      }
    })

    docs.forEach(doc => {
      const docId = doc._id
      const parentId = doc.parentId || 'root'
      if (treeItems[parentId]) {
        treeItems[parentId].children.push(docId)
      }
    })

    // Remove empty children arrays
    Object.values(treeItems).forEach(item => {
      if (!item.isFolder || item.children.length === 0) {
        delete item.children
      }
    })

    return { items: treeItems }
  }, [docs, folders])

  // console.log('KIRAN Items:', items)

  const dataProvider = useMemo(
    () => 
      new StaticTreeDataProvider(items.items, (item, data) => ({
        ...item,
        data
      })),
    [items]
  )

  useEffect(() => {
    dataProvider.onDidChangeTreeDataEmitter.emit(['root'])
  }, [items, dataProvider])

  const handleSelect = (selectedItems: TreeItemIndex[], _treeId: string) => {
    const selectedId = selectedItems[0]?.toString()
    if (selectedId && items.items[selectedId]) {
      const item = items.items[selectedId]
      if (item && item.isFolder) {
        setNewFolderParentId(selectedId)
      }
    }
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

  const handleCreateFolder = () => {
    const title = prompt('Enter folder name:')
    if (title) {
      createFolder(title, newFolderParentId)
    }
  }

  const handleDrop = async (draggedItems: TreeItem<any>[], position: DraggingPosition) => {
    console.log('Dragged items:', draggedItems)
    console.log('Drop position:', position)
    
    if (position.targetType === 'between-items') {
      console.log('Dropped between items - this is not supported')
      return
    }

    const targetId = position.targetItem
    const targetItem = items.items[targetId]
    
    if (!targetItem?.isFolder) {
      console.log('Target is not a folder - drop canceled')
      return
    }

    console.log('Successfully dropped onto folder:', targetItem.data)
    
    // Update the underlying data structures and server
    for (const item of draggedItems) {
      const itemId = item.index.toString()
      const targetFolderId = targetId === 'root' ? undefined : targetId.toString()

      try {
        // Find and update the document or folder in the original arrays
        const docIndex = docs.findIndex(d => d._id === itemId)
        if (docIndex !== -1) {
          // Update document on server
          await fetch(`/api/documents/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: targetFolderId })
          })
          // Update local document state
          docs[docIndex] = { ...docs[docIndex], parentId: targetFolderId }
          console.log(`Updated document ${itemId} to have parent ${targetFolderId}`)
        }

        const folderIndex = folders.findIndex(f => f._id === itemId)
        if (folderIndex !== -1) {
          // Update folder on server
          await fetch(`/api/folders/${itemId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: targetFolderId })
          })
          // Update local folder state
          folders[folderIndex] = { ...folders[folderIndex], parentId: targetFolderId }
          console.log(`Updated folder ${itemId} to have parent ${targetFolderId}`)
        }

      } catch (error) {
        console.error('Error updating item location:', error)
      }
    }

    // Let the parent component's state update handle the tree structure
    // instead of manually updating it here
  }

  const emptyMessage = (
    <div className={'text-center text-[14px] font-semibold uppercase text-black/[.5]'}>
      Empty / Go create something of worth
    </div>
  )

  return (
    <Layout>
      <div className="gradient absolute left-0 top-0 z-[-1] h-screen w-screen" />
      <div className="relative top-[44px] flex h-[calc(100vh_-_44px)] justify-center pb-10">
        <div className="flex w-11/12 max-w-[740px] flex-col justify-center sm:w-9/12">
          <div className="flex justify-end mb-4">
            <Tooltip title="Create new folder">
              <IconButton
                onClick={handleCreateFolder}
                className="hover:bg-black/[.10]"
              >
                <CreateNewFolderIcon />
              </IconButton>
            </Tooltip>
          </div>
          <div className="max-h-[calc(100vh_-_100px)] overflow-y-auto rounded-lg bg-white/[.05] p-4">
            {showSpinner && <Loader />}
            {!isLoading && (!docs || docs.length === 0) && (!folders || folders.length === 0) && emptyMessage}
            {(!isLoading && docs && folders) && (docs.length > 0 || folders.length > 0) && (
              <>
                <UncontrolledTreeEnvironment
                  dataProvider={dataProvider}
                  getItemTitle={item => item.data}
                  viewState={{
                    'tree-1': {
                      expandedItems: []
                    }
                  }}
                  canDragAndDrop={true}
                  canDropOnFolder={true}
                  canReorderItems={true}
                  renderItem={(props) => {
                    const { item, depth, arrow, context } = props
                    const isFolder = Boolean(item.isFolder)
                    const icon = isFolder ? <FolderIcon /> : <InsertDriveFileIcon />

                    return (
                      <li 
                        {...props.context.itemContainerWithChildrenProps}
                        className="list-none"
                      >
                        <div 
                          {...props.context.itemContainerWithoutChildrenProps}
                          {...context.interactiveElementProps}
                          className={`flex items-center justify-between py-2 px-2 hover:bg-white/[.1] rounded cursor-pointer ${
                            context.isSelected ? 'bg-white/[.1]' : ''
                          }`}
                          style={{
                            paddingLeft: `${(depth + 1) * 20}px`,
                            backgroundColor: item.index === 'root' ? 'transparent' : undefined
                          }}
                        >
                          <div className="flex items-center min-w-[200px] gap-2">
                            <div className="flex items-center gap-1">
                              {isFolder && (
                                <div className="w-4 h-4 flex items-center justify-center">
                                  {arrow}
                                </div>
                              )}
                              {icon}
                            </div>
                            <span className="uppercase text-black/[.70] block h-[24px] leading-[24px]">
                              {item.data}
                            </span>
                          </div>
                          {item.index !== 'root' && (
                            <div className="flex items-center">
                              <IconButton
                                size="small"
                                onClick={e => {
                                  e.stopPropagation()
                                  handleMenuClick(e, item.index.toString())
                                }}
                                className="hover:bg-black/[.10]">
                                <MoreHorizIcon fontSize="small" />
                              </IconButton>
                            </div>
                          )}
                        </div>
                        {props.children}
                      </li>
                    )
                  }}
                  onSelectItems={handleSelect}
                  onDrop={handleDrop}
                >
                  <Tree 
                    treeId="tree-1" 
                    rootItem="root"
                  />
                </UncontrolledTreeEnvironment>
              </>
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
            const item = items.items[selectedDocId]
            if (item && item.data) {
              if ('parentId' in item.data) {
                renameFolder(selectedDocId, newName)
              } else {
                renameDocument(selectedDocId, newName)
              }
            }
          }
          setSelectedDoc(null)
        }}
        initialValue={selectedDocId ? (items.items[selectedDocId]?.data?.title || '') : ''}
      />

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setSelectedDoc(null)
        }}
        onConfirm={() => {
          if (selectedDocId) {
            const item = items.items[selectedDocId]
            if (item && item.data) {
              if ('parentId' in item.data) {
                deleteFolder(selectedDocId)
              } else {
                deleteDocument(selectedDocId)
              }
            }
          }
          setSelectedDoc(null)
        }}
        documentTitle={selectedDocId ? (items.items[selectedDocId]?.data?.title?.toUpperCase() || 'UNTITLED') : 'UNTITLED'}
      />
    </Layout>
  )
}

export default SharedDocumentsPage
