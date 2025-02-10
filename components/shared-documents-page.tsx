'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { DocumentData, FolderData } from '@typez/globals'
import { useState, useMemo, useEffect } from 'react'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import NoteAddIcon from '@mui/icons-material/NoteAdd'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import RenameModal from './rename-modal'
import DeleteModal from './delete-modal'
import CreateFolderModal from './create-folder-modal'
import { ControlledTreeEnvironment, Tree, TreeItemIndex, TreeItem, DraggingPosition } from 'react-complex-tree'
import 'react-complex-tree/lib/style.css'
import { useNavigation, useAPI } from '@components/providers'
import { useUser } from '@wrappers/auth-wrapper-client'
import { motion, AnimatePresence } from 'framer-motion'

interface TreeItemData {
  index: TreeItemIndex
  canMove: boolean
  canRename: boolean
  isFolder: boolean
  children?: TreeItemIndex[]
  data: string
  folderIndex?: number
}

export interface SharedDocumentsPageProps {
  docs: DocumentData[]
  folders: FolderData[]
  isLoading: boolean
  renameDocument: (id: string, title: string) => void
  createFolder: (title: string, parentId?: string) => void
  renameFolder: (id: string, title: string) => void
  onMove?: (itemId: string, targetFolderId?: string, dropIndex?: number) => Promise<void>
  bulkDelete: (documentIds: string[], folderIds: string[]) => Promise<void>
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

  // Tree view state
  const [focusedItem, setFocusedItem] = useState<TreeItemIndex>()
  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>([])
  const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([])

  // Add focus monitoring
  useEffect(() => {
    const handleFocusChange = () => {
      const focusedElement = document.activeElement
    }

    document.addEventListener('focusin', handleFocusChange)
    return () => document.removeEventListener('focusin', handleFocusChange)
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
        setFocusedItem(undefined)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedItems, deleteModalOpen, renameModalOpen, createFolderModalOpen])

  const items = useMemo(() => {
    const treeItems: Record<string, TreeItemData> = {
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
        data: folder.title,
        folderIndex: folder.folderIndex
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
        data: doc.title,
        folderIndex: doc.folderIndex
      }
    })

    // Build tree structure with sorted children
    folders.forEach(folder => {
      const folderId = folder._id
      const parentId = folder.parentId || 'root'
      if (treeItems[parentId]) {
        treeItems[parentId].children = treeItems[parentId].children || []
        treeItems[parentId].children.push(folderId)
      }
    })

    docs.forEach(doc => {
      const docId = doc._id
      const parentId = doc.parentId || 'root'
      if (treeItems[parentId]) {
        treeItems[parentId].children = treeItems[parentId].children || []
        treeItems[parentId].children.push(docId)
      }
    })

    // Sort children by folderIndex
    Object.values(treeItems).forEach(item => {
      if (item.children) {
        item.children.sort((a: string, b: string) => {
          const itemA = treeItems[a]
          const itemB = treeItems[b]
          return (itemA.folderIndex || 0) - (itemB.folderIndex || 0)
        })
      }
    })

    return treeItems
  }, [docs, folders])

  const handleSelect = (items: TreeItemIndex[]) => {
    // Ensure we're passing a new array reference to trigger re-render
    const newSelectedItems = [...items]
    setSelectedItems(newSelectedItems)
    
    // Only set folder parent when a single folder is selected
    if (items.length === 1) {
      const selectedId = items[0]?.toString()
      const selectedItem = selectedId ? items[selectedId] : null
      if (!selectedId || !selectedItem) return

      if (selectedItem.isFolder) {
        setNewFolderParentId(selectedId)
      }
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
    console.log('handleMenuClick called with id:', id)
    event.stopPropagation()
    setAnchorEl(event.currentTarget)
    setSelectedDoc(id)
    setSelectedItems([id])
    console.log('Updated selectedItems in menu click:', [id])
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
      const selectedDocs = selectedItems.filter(id => !items[id.toString()]?.isFolder).map(id => id.toString())
      const selectedFolders = selectedItems.filter(id => items[id.toString()]?.isFolder).map(id => id.toString())

      await bulkDelete(selectedDocs, selectedFolders)
      setDeleteModalOpen(false)
      setSelectedItems([])
    } catch (error) {
      console.error('Error deleting items:', error)
      // You might want to show an error message to the user here
    }
  }

  const handleCreateFolder = () => {
    setCreateFolderModalOpen(true)
  }

  const handleCollapseAll = () => {
    setExpandedItems([])
  }

  const handleExpandAll = () => {
    // Get all folder IDs
    const folderIds = Object.values(items)
      .filter(item => item.isFolder)
      .map(item => item.index)
    setExpandedItems(folderIds)
  }

  const handleDrop = async (draggedItems: TreeItem<any>[], position: DraggingPosition) => {
    // Handle both direct folder drops and root level drops
    let targetId = 'root'
    let targetIndex = 0
    
    console.log('Drop event details:', {
      draggedItems: draggedItems.map(item => ({
        id: item.index,
        data: items[item.index]?.data
      })),
      position,
      currentItems: items
    })
    
    if (position.targetType === 'item') {
      const targetItem = items[position.targetItem]
      if (!targetItem?.isFolder) {
        console.log('Cancelled - target is not a folder:', targetItem)
        return
      }
      targetId = position.targetItem.toString()
      console.log('Dropping into folder:', { targetId, targetItem })
      
      // Expand the target folder when dropping into it
      if (!expandedItems.includes(position.targetItem)) {
        setExpandedItems([...expandedItems, position.targetItem])
      }
    } else if (position.targetType === 'between-items') {
      targetId = position.parentItem || 'root'
      targetIndex = position.childIndex
      console.log('Dropping between items:', {
        parentId: targetId,
        targetIndex,
        parentChildren: items[targetId]?.children
      })
    }

    for (const item of draggedItems) {
      const itemId = item.index.toString()
      const targetFolderId = targetId === 'root' ? undefined : targetId
      
      console.log('Moving item:', {
        itemId,
        itemData: items[itemId]?.data,
        targetFolderId,
        targetIndex,
        currentParent: items[itemId]?.parentId
      })
      
      if (onMove) {
        try {
          await onMove(itemId, targetFolderId, targetIndex)
          console.log('Move completed successfully')
        } catch (error) {
          console.error('Move failed:', error)
        }
      }
    }
  }

  const handleCreateDocument = async () => {
    try {
      const response = await post('/documents', { 
        userId: user?.sub,
        title: 'Untitled'
      })
      const docId = response._id || response.id
      if (!docId) {
        console.error('No document ID in response:', response)
        return
      }
      navigateTo(`/documents/${docId}?focus=title`)
    } catch (error) {
      console.error('Error creating document:', error)
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
              <div className="[&_.rct-tree-root-focus]:!outline-none">
                <style>{`
                  :root {
                    --rct-color-tree-bg: rgba(255, 255, 255, 0.05);
                    --rct-color-drag-between-line-bg: rgba(0, 0, 0, 0.3);
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
                  .rct-tree-item-button {
                    outline: none !important;
                    -webkit-tap-highlight-color: transparent;
                  }
                  .rct-tree-item-button:focus {
                    outline: none !important;
                    background-color: transparent !important;
                  }
                  .rct-tree-item-button:focus-visible {
                    outline: none !important;
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
                      selectedItems,
                    }
                  }}
                  onFocusItem={item => {
                    // Prevent focus from being set
                    return
                  }}
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
                            context.isSelected ? '!bg-white/[.25]' : ''
                          }`}
                          style={{
                            paddingLeft: `${(depth + 1) * 20}px`,
                            backgroundColor: item.index === 'root' ? 'transparent' : undefined,
                            transition: 'background-color 0s'  // Force immediate background color change
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
        documentTitle={selectedItems.length > 0 ? selectedItems.map(id => items[id.toString()]?.data.toUpperCase()).join(', ') : 'UNTITLED'}
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
