'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { useSpinner } from '@lib/hooks'
import { DocumentData, FolderData } from '@typez/globals'
import { format } from 'date-fns'
import { useState, useRef, useEffect, useMemo, memo } from 'react'
import { useNavigation } from './providers'
import { TreeView, TreeItem } from '@mui/x-tree-view'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import FolderIcon from '@mui/icons-material/Folder'
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile'
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material'
import RenameModal from './rename-modal'
import DeleteModal from './delete-modal'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  useDroppable,
  pointerWithin,
  rectIntersection,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

const TreeItemContent = memo(({ 
  item, 
  editingDocId, 
  editingTitle, 
  editInputRef,
  handleEditKeyDown,
  handleEditBlur,
  setEditingTitle,
  handleMenuClick,
}: {
  item: DocumentData | FolderData
  editingDocId: string | null
  editingTitle: string
  editInputRef: React.RefObject<HTMLInputElement>
  handleEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, docId: string) => void
  handleEditBlur: (docId: string) => void
  setEditingTitle: (value: string) => void
  handleMenuClick: (event: React.MouseEvent<HTMLElement>, id: string) => void
}) => {
  const isFolder = !('content' in item)
  const icon = isFolder ? <FolderIcon /> : <InsertDriveFileIcon />
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    over,
  } = useSortable({
    id: item.id,
    data: {
      type: isFolder ? 'folder' : 'document',
      item,
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: over ? 'rgba(255, 255, 255, 0.2)' : undefined,
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center justify-between py-2"
      data-type={isFolder ? 'folder' : 'document'}
    >
      <div className="flex items-center min-w-[200px] gap-2">
        {icon}
        {editingDocId === item.id ? (
          <input
            ref={editInputRef}
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => handleEditKeyDown(e, item.id)}
            onBlur={() => handleEditBlur(item.id)}
            className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 uppercase text-black/[.70] w-full p-0 m-0 h-[24px] leading-[24px]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="uppercase text-black/[.70] block h-[24px] leading-[24px]">
            {item.title}
          </span>
        )}
      </div>
      <div className="flex items-center">
        <span className="mr-4 text-black/[.65] capitalize">{formatDate(item.lastUpdated)}</span>
        <IconButton
          size="small"
          onClick={e => handleMenuClick(e, item.id)}
          className="hover:bg-black/[.10]">
          <MoreHorizIcon fontSize="small" />
        </IconButton>
      </div>
    </div>
  )
})

TreeItemContent.displayName = 'TreeItemContent'

const DroppableTreeItem = memo(({ 
  nodeId, 
  label, 
  children, 
  onClick,
  item,
}: { 
  nodeId: string
  label: React.ReactNode
  children?: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  item: DocumentData | FolderData
}) => {
  return (
    <TreeItem
      nodeId={nodeId}
      onClick={onClick}
      label={label}
    >
      {children}
    </TreeItem>
  )
})

DroppableTreeItem.displayName = 'DroppableTreeItem'

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
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [renameModalOpen, setRenameModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const showSpinner = useSpinner(isLoading)
  const { navigateTo } = useNavigation()
  const [newFolderParentId, setNewFolderParentId] = useState<string | undefined>()
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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

  const handleCreateFolder = () => {
    const title = prompt('Enter folder name:')
    if (title) {
      createFolder(title, newFolderParentId)
    }
  }

  const emptyMessage = (
    <div className={'text-center text-[14px] font-semibold uppercase text-black/[.5]'}>
      Empty / Go create something of worth
    </div>
  )

  // Memoize the combined items array
  const allItems = useMemo(() => {
    return [...docs, ...folders]
  }, [docs, folders])

  const renderTree = (parentId?: string, visited = new Set<string>()) => {
    const filteredItems = allItems.filter(item => {
      if ('content' in item) {
        // DocumentData
        return item.location === parentId
      }
      // FolderData – only include if not already visited
      return item.parentId === parentId && !visited.has(item.id)
    })
  
    return filteredItems.map(item => {
      const isFolder = !('content' in item)
      if (isFolder) {
        visited.add(item.id)
      }
      return (
        <DroppableTreeItem
          key={item.id}
          nodeId={item.id}
          item={item}
          onClick={e =>
            isFolder
              ? setNewFolderParentId(item.id)
              : handleClick(e, item as DocumentData)
          }
          label={
            <TreeItemContent
              item={item}
              editingDocId={editingDocId}
              editingTitle={editingTitle}
              editInputRef={editInputRef}
              handleEditKeyDown={handleEditKeyDown}
              handleEditBlur={handleEditBlur}
              setEditingTitle={setEditingTitle}
              handleMenuClick={handleMenuClick}
            />
          }
        >
          {isFolder && renderTree(item.id, visited)}
        </DroppableTreeItem>
      )
    })
  }
  
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    console.log('Drag start:', {
      id: active.id,
      type: active.data.current?.type,
      rect: active.rect
    })
    setActiveId(active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    console.log('Drag event:', {
      activeId: active.id,
      activeType: active.data.current?.type,
      overId: over?.id,
      overType: over?.data.current?.type,
      overRect: over?.rect
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    console.log('Drag end:', {
      activeId: active.id,
      activeType: active.data.current?.type,
      overId: over?.id,
      overType: over?.data.current?.type,
      delta: event.delta
    })

    if (!over) {
      setActiveId(null)
      return
    }

    if (active.id !== over.id) {
      const activeData = active.data.current
      const overData = over.data.current
      
      if (activeData?.type === 'document') {
        // Handle document move
        const doc = docs.find(d => d.id === active.id)
        if (doc) {
          // If over a folder, move document to that folder
          if (overData?.type === 'folder') {
            const updatedDoc = { ...doc, location: over.id as string }
            console.log('Moving document to folder:', updatedDoc)
          }
        }
      } else if (activeData?.type === 'folder') {
        // Handle folder move
        const folder = folders.find(f => f.id === active.id)
        if (folder && overData?.type === 'folder') {
          const updatedFolder = { ...folder, parentId: over.id as string }
          console.log('Moving folder to new parent:', updatedFolder)
        }
      }
    }

    setActiveId(null)
  }

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
              <DndContext
                sensors={sensors}
                collisionDetection={rectIntersection}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={allItems.map(item => item.id)}
                  strategy={verticalListSortingStrategy}
                >
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
                    {renderTree()}
                  </TreeView>
                </SortableContext>
                <DragOverlay>
                  {activeId ? (
                    <div className="opacity-50">
                      <TreeItemContent
                        item={allItems.find(item => item.id === activeId)!}
                        editingDocId={null}
                        editingTitle=""
                        editInputRef={editInputRef}
                        handleEditKeyDown={handleEditKeyDown}
                        handleEditBlur={handleEditBlur}
                        setEditingTitle={setEditingTitle}
                        handleMenuClick={handleMenuClick}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
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
