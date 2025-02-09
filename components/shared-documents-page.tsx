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
import { ControlledTreeEnvironment, Tree, TreeItemIndex, TreeItem, DraggingPosition } from 'react-complex-tree'
import 'react-complex-tree/lib/style.css'
import { useNavigation } from '@components/providers'
import { motion, AnimatePresence } from 'framer-motion'

export interface SharedDocumentsPageProps {
  docs: DocumentData[]
  folders: FolderData[]
  isLoading: boolean
  deleteDocument: (id: string) => void
  renameDocument: (id: string, title: string) => void
  createFolder: (title: string, parentId?: string) => void
  deleteFolder: (id: string) => void
  renameFolder: (id: string, title: string) => void
  onMove?: (itemId: string, targetFolderId?: string) => Promise<void>
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
  onMove,
}: SharedDocumentsPageProps) => {
  const { navigateTo } = useNavigation()
  const [selectedDocId, setSelectedDoc] = useState<string | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const showSpinner = useSpinner(isLoading)
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>()

  // Tree view state
  const [focusedItem, setFocusedItem] = useState<TreeItemIndex>()
  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>([])
  const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([])

  const items = useMemo(() => {
    const treeItems: Record<string, any> = {
      root: {
        index: 'root',
        canMove: false,
        canRename: false,
        isFolder: true,
        children: [],
        data: 'root'
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

    return treeItems
  }, [docs, folders])

  const handleSelect = (items: TreeItemIndex[]) => {
    setSelectedItems(items)
    const selectedId = items[0]?.toString()
    if (!selectedId || !items[selectedId]) return

    const item = items[selectedId]
    if (item.isFolder) {
      setNewFolderParentId(selectedId)
    }
  }

  const handlePrimaryAction = (item: TreeItem) => {
    const selectedId = item.index.toString()
    if (!selectedId || !items[selectedId]) return

    const treeItem = items[selectedId]
    if (!treeItem.isFolder) {
      navigateTo(`/documents/${selectedId}`)
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
    // Handle both direct folder drops and root level drops
    let targetId = 'root'
    
    if (position.targetType === 'item') {
      const targetItem = items[position.targetItem]
      if (!targetItem?.isFolder) {
        return
      }
      targetId = position.targetItem.toString()
    } else if (position.targetType === 'between-items' && position.parentItem === 'root') {
      targetId = 'root'
    } else {
      return
    }
    
    // Update items through parent callback
    for (const item of draggedItems) {
      const itemId = item.index.toString()
      const targetFolderId = targetId === 'root' ? undefined : targetId

      if (onMove) {
        try {
          await onMove(itemId, targetFolderId)
        } catch (error) {
          console.error('Error moving item:', error)
        }
      }
    }
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
              <div className="[&_.rct-tree-root-focus]:!outline-none">
                <style>{`
                  :root {
                    --rct-color-tree-bg: rgba(255, 255, 255, 0.05);
                  }
                  .rct-tree-items-container {
                    transition: all 0.2s ease-out;
                    transform-origin: top;
                  }
                  .rct-tree-item-li {
                    transition: all 0.2s ease-out;
                  }
                  .rct-tree-item-li-expanded > .rct-tree-items-container {
                    animation: expandIn 0.2s ease-out;
                  }
                  .rct-tree-item-title-container {
                    outline: none !important;
                  }
                  .rct-tree-item-button:focus {
                    outline: none !important;
                    background-color: rgba(255, 255, 255, 0.2) !important;
                  }
                  @keyframes expandIn {
                    from {
                      opacity: 0;
                      transform: translateY(-10px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                `}</style>
                <ControlledTreeEnvironment
                  items={items}
                  getItemTitle={item => item.data}
                  viewState={{
                    'tree-1': {
                      focusedItem,
                      expandedItems,
                      selectedItems
                    }
                  }}
                  onFocusItem={item => setFocusedItem(item.index)}
                  onExpandItem={item => setExpandedItems([...expandedItems, item.index])}
                  onCollapseItem={item => 
                    setExpandedItems(expandedItems.filter(expandedItemIndex => expandedItemIndex !== item.index))
                  }
                  onSelectItems={handleSelect}
                  onPrimaryAction={handlePrimaryAction}
                  onDrop={handleDrop}
                  canDragAndDrop={true}
                  canDropOnFolder={true}
                  canReorderItems={true}
                  renderItem={props => {
                    const { item, depth, arrow, context } = props
                    const isFolder = Boolean(item.isFolder)

                    return (
                      <li 
                        {...props.context.itemContainerWithChildrenProps}
                        className="list-none [&_.rct-tree-item-button-focus]:!outline-none"
                      >
                        <div 
                          {...props.context.itemContainerWithoutChildrenProps}
                          {...context.interactiveElementProps}
                          className={`flex items-center justify-between py-1.5 px-2 hover:bg-white/[.2] rounded-lg cursor-pointer ${
                            context.isSelected ? 'bg-white/[.2]' : ''
                          }`}
                          style={{
                            paddingLeft: `${(depth + 1) * 20}px`,
                            backgroundColor: item.index === 'root' ? 'transparent' : undefined
                          }}
                        >
                          <div className="flex items-center min-w-[200px] gap-2">
                            <div className="flex items-center gap-1">
                              {isFolder && (
                                <div className="w-3.5 h-3.5 flex items-center justify-center">
                                  {arrow}
                                </div>
                              )}
                            </div>
                            <span className="uppercase text-black/[.70] text-sm font-semibold block h-[20px] leading-[20px]">
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
                        <AnimatePresence initial={false} mode="wait">
                          {props.children && (
                            <motion.div
                              initial={{ opacity: 0, height: 0, y: -5 }}
                              animate={{ 
                                opacity: context.isExpanded ? 1 : 0,
                                height: context.isExpanded ? 'auto' : 0,
                                y: context.isExpanded ? 0 : -5,
                                transitionEnd: {
                                  overflow: context.isExpanded ? 'visible' : 'hidden'
                                }
                              }}
                              exit={{ opacity: 0, height: 0, y: -5, overflow: 'hidden' }}
                              transition={{ 
                                duration: 0.3,
                                ease: [0.2, 0.8, 0.2, 1.0],
                                opacity: { duration: 0.35 }
                              }}
                            >
                              {props.children}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    )
                  }}
                >
                  <Tree 
                    treeId="tree-1" 
                    rootItem="root"
                  />
                </ControlledTreeEnvironment>
              </div>
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
              // Check if it's a folder by looking at the isFolder property
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
        onConfirm={() => {
          if (selectedDocId) {
            const item = items[selectedDocId]
            if (item) {
              if (item.isFolder) {
                deleteFolder(selectedDocId)
              } else {
                deleteDocument(selectedDocId)
              }
            }
          }
          setSelectedDoc(null)
        }}
        documentTitle={selectedDocId && items[selectedDocId] ? items[selectedDocId].data.toString().toUpperCase() : 'UNTITLED'}
      />
    </Layout>
  )
}

export default SharedDocumentsPage
