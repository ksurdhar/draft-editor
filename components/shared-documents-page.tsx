'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { DocumentData, FolderData } from '@typez/globals'
import { format } from 'date-fns'
import { useState, useMemo } from 'react'
import { useNavigation } from './providers'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import RenameModal from './rename-modal'
import DeleteModal from './delete-modal'
import { UncontrolledTreeEnvironment, Tree, StaticTreeDataProvider, TreeItemIndex, TreeItemRenderContext, TreeItem, TreeInformation, DraggingPosition } from 'react-complex-tree'
import 'react-complex-tree/lib/style.css'
import { ReactNode } from 'react'

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
  const { navigateTo } = useNavigation()
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>()

  const items = useMemo(() => {
    console.log('Folders:', folders)
    console.log('Docs:', docs)
    
    const treeItems: Record<string, any> = {
      root: {
        index: 'root',
        canMove: false,
        canRename: false,
        data: {
          title: 'Root',
          lastUpdated: null
        },
        children: [],
        isFolder: true,
      }
    }

    // Add folders first
    folders.forEach(folder => {
      const folderId = (folder as any)._id || folder.id
      treeItems[folderId] = {
        index: folderId,
        canMove: true,
        canRename: true,
        data: folder,
        children: [],
        isFolder: true,
      }
    })

    // Add documents
    docs.forEach(doc => {
      const docId = (doc as any)._id || doc.id
      treeItems[docId] = {
        index: docId,
        canMove: true,
        canRename: true,
        data: doc,
        children: [],
        isFolder: false,
      }
    })

    // Build tree structure
    folders.forEach(folder => {
      const folderId = (folder as any)._id || folder.id
      const parentId = folder.parentId || 'root'
      if (treeItems[parentId]) {
        treeItems[parentId].children.push(folderId)
        console.log('Added folder to parent:', { folderId, parentId, children: treeItems[parentId].children })
      }
    })

    docs.forEach(doc => {
      const docId = (doc as any)._id || doc.id
      const parentId = doc.location || 'root'
      if (treeItems[parentId]) {
        treeItems[parentId].children.push(docId)
      }
    })

    console.log('Tree Items:', treeItems)
    return treeItems
  }, [docs, folders])

  const dataProvider = useMemo(
    () => {
      const provider = new StaticTreeDataProvider(items, (item, data) => ({
        ...item,
        data: {
          ...item.data,
          title: data
        }
      }))

      // Initialize the tree with all items expanded
      const allIds = Object.keys(items)
      provider.onDidChangeTreeData(() => {
        allIds.forEach(id => {
          provider.onDidChangeTreeDataEmitter.emit([id])
        })
      })

      return provider
    },
    [items]
  )

  // Log tree structure whenever it changes
  useMemo(() => {
    console.log('Current tree structure:', {
      items,
      expandedItems: ['root', ...folders.map(f => (f as any)._id || f.id)],
      folderCount: folders.length,
      docCount: docs.length
    })
  }, [items, folders, docs])

  const handleSelect = (selectedItems: TreeItemIndex[], _treeId: string) => {
    const selectedId = selectedItems[0]?.toString()
    if (selectedId && items[selectedId]) {
      const item = items[selectedId]
      if (item && !item.isFolder) {
        navigateTo(`/documents/${selectedId}`)
      } else if (item) {
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

  const handleDrop = (draggedItems: TreeItem<any>[], position: DraggingPosition) => {
    console.log('Drop items:', draggedItems, 'onto position:', position)
    
    if (position.targetType === 'between-items') return
    const targetId = position.targetItem
    const targetItem = items[targetId]
    if (!targetItem?.isFolder) return

    // Update the parent references in the backend
    draggedItems.forEach(async (item) => {
      const itemData = item.data
      if (!itemData) return

      if ('parentId' in itemData) {
        // Update folder parent
        await fetch(`/api/folders/${itemData._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: targetItem.data._id || null })
        })
      } else {
        // Update document location
        await fetch(`/api/documents/${itemData._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: targetItem.data._id || null })
        })
      }
    })

    // Update local tree data
    draggedItems.forEach(item => {
      const sourceParentId = item.data.parentId || item.data.location || 'root'
      const sourceParent = items[sourceParentId]
      if (sourceParent) {
        sourceParent.children = sourceParent.children.filter((id: string) => id !== item.index)
      }
      targetItem.children.push(item.index)
    })

    // Notify the tree of changes
    dataProvider.onDidChangeTreeDataEmitter.emit(['root'])
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
                  getItemTitle={item => item.data?.title || ''}
                  viewState={{
                    ['tree-1']: {
                      expandedItems: ['root', ...folders.map(f => f._id || f.id)],
                    }
                  }}
                  canDragAndDrop={true}
                  canDropOnFolder={true}
                  canReorderItems={true}
                  renderItem={(props) => {
                    const { item, depth, arrow, context } = props
                    const isFolder = Boolean(item.isFolder)
                    const icon = isFolder ? <FolderIcon /> : <InsertDriveFileIcon />
                    const itemData = item.data

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
                              {itemData?.title || ''}
                            </span>
                          </div>
                          {itemData && item.index !== 'root' && (
                            <div className="flex items-center">
                              <span className="mr-4 text-black/[.65] capitalize">
                                {formatDate(itemData.lastUpdated)}
                              </span>
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
            const item = items[selectedDocId]
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
        initialValue={selectedDocId ? (items[selectedDocId]?.data?.title || '') : ''}
      />

      <DeleteModal
        open={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setSelectedDoc(null)
        }}
        onConfirm={() => {
          if (selectedDocId) {
            const item = items[selectedDocId]
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
        documentTitle={selectedDocId ? (items[selectedDocId]?.data?.title?.toUpperCase() || 'UNTITLED') : 'UNTITLED'}
      />
    </Layout>
  )
}

export default SharedDocumentsPage
