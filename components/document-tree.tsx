import {
  ControlledTreeEnvironment,
  Tree,
  TreeItemIndex,
  TreeItem,
  DraggingPosition,
} from 'react-complex-tree'
import 'react-complex-tree/lib/style.css'
import { IconButton } from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useState, useRef } from 'react'
import { DocumentData, FolderData } from '@typez/globals'
import { ListItem } from './list-item'

export interface TreeItemData {
  index: TreeItemIndex
  canMove: boolean
  canRename: boolean
  isFolder: boolean
  children?: TreeItemIndex[]
  data: string
  folderIndex?: number
}

export interface DocumentTreeProps {
  items: Record<string, TreeItemData>
  onPrimaryAction?: (item: TreeItem) => void
  onMove?: (itemId: string, targetFolderId?: string, dropIndex?: number) => Promise<void>
  showActionButton?: boolean
  onActionButtonClick?: (event: React.MouseEvent<HTMLElement>, itemId: string) => void
  className?: string
  style?: React.CSSProperties
  selectedItems?: TreeItemIndex[]
  onSelectedItemsChange?: (items: TreeItemIndex[]) => void
  persistExpanded?: boolean
  theme?: 'light' | 'dark'
  showSelectedStyles?: boolean
}

export const createTreeItems = (
  docs: DocumentData[],
  folders: FolderData[],
): Record<string, TreeItemData> => {
  const treeItems: Record<string, TreeItemData> = {
    root: {
      index: 'root',
      canMove: false,
      canRename: false,
      isFolder: true,
      children: [],
      data: 'root',
    },
  }

  // Add folders first
  folders.forEach(folder => {
    const folderId = folder._id || folder.id
    if (!folderId) {
      console.warn('Found folder without ID:', folder)
      return
    }
    if (treeItems[folderId]) {
      console.warn('Duplicate folder ID:', folderId)
      return
    }
    treeItems[folderId] = {
      index: folderId,
      canMove: true,
      canRename: true,
      isFolder: true,
      children: [],
      data: folder.title || 'Untitled Folder',
      folderIndex: folder.folderIndex,
    }
  })

  // Add documents
  docs.forEach(doc => {
    const docId = doc._id || doc.id
    if (!docId) {
      console.warn('Found document without ID:', doc)
      return
    }
    if (treeItems[docId]) {
      console.warn('Duplicate document ID:', docId)
      return
    }
    treeItems[docId] = {
      index: docId,
      canMove: true,
      canRename: true,
      isFolder: false,
      data: doc.title || 'Untitled',
      folderIndex: doc.folderIndex,
    }
  })

  // Build tree structure with sorted children
  folders.forEach(folder => {
    const folderId = folder._id || folder.id
    if (!folderId) return
    const parentId = folder.parentId || 'root'
    if (treeItems[parentId]) {
      treeItems[parentId].children = treeItems[parentId].children || []
      const children = treeItems[parentId].children
      if (children && !children.includes(folderId)) {
        children.push(folderId)
      }
    }
  })

  docs.forEach(doc => {
    const docId = doc._id || doc.id
    if (!docId) return
    const parentId = doc.parentId || 'root'
    if (treeItems[parentId]) {
      treeItems[parentId].children = treeItems[parentId].children || []
      const children = treeItems[parentId].children
      if (children && !children.includes(docId)) {
        children.push(docId)
      }
    }
  })

  // Sort children by folderIndex
  Object.values(treeItems).forEach(item => {
    if (item.children) {
      item.children.sort((a, b) => {
        const itemA = treeItems[a.toString()]
        const itemB = treeItems[b.toString()]
        return (itemA?.folderIndex || 0) - (itemB?.folderIndex || 0)
      })
    }
  })

  return treeItems
}

export interface HandleMoveParams {
  draggedItems: TreeItem[]
  position: DraggingPosition
  items: Record<string, TreeItemData>
  onMove?: (itemId: string, targetFolderId?: string, dropIndex?: number) => Promise<void>
}

export const handleMove = async ({ draggedItems, position, items, onMove }: HandleMoveParams) => {
  let targetId = 'root'
  let targetIndex = 0

  if (position.targetType === 'item') {
    const targetItem = items[position.targetItem]
    if (!targetItem?.isFolder) {
      return
    }
    targetId = position.targetItem.toString()
  } else if (position.targetType === 'between-items') {
    targetId = (position.parentItem || 'root').toString()
    targetIndex = position.childIndex
  }

  for (const item of draggedItems) {
    const itemId = item.index.toString()
    const targetFolderId = targetId === 'root' ? undefined : targetId

    if (onMove) {
      try {
        await onMove(itemId, targetFolderId, targetIndex)
      } catch (error) {
        console.error('Move failed:', error)
      }
    }
  }
}

const DocumentTree = ({
  items,
  onPrimaryAction,
  onMove,
  showActionButton = false,
  onActionButtonClick,
  className = '',
  style = {},
  selectedItems: externalSelectedItems,
  onSelectedItemsChange,
  persistExpanded = false,
  theme = 'light',
  showSelectedStyles = true,
}: DocumentTreeProps) => {
  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>(() => {
    if (persistExpanded) {
      try {
        const stored = localStorage.getItem('editor-tree-expanded')
        return stored ? JSON.parse(stored) : []
      } catch (e) {
        console.error('Error reading from localStorage:', e)
        return []
      }
    }
    return []
  })
  const hasRecentDoubleClickRef = useRef(false)
  const pendingActionRef = useRef<{ item: TreeItem; timestamp: number } | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const floatingInputRef = useRef<HTMLInputElement>(null)
  const editPositionRef = useRef<{ top: number; left: number; width: number } | null>(null)

  // Use external selected items only
  const selectedItems = externalSelectedItems || []

  const handleSelect = (items: TreeItemIndex[]) => {
    console.log('🎯 Selection requested:', items)
    // Selection is now handled by the click handlers in ListItem
  }

  const executePrimaryAction = (item: TreeItem) => {
    const selectedId = item.index.toString()
    if (!selectedId || !items[selectedId]) return

    const treeItem = items[selectedId]
    if (!treeItem.isFolder) {
      const currentUrl = window.location.pathname
      const baseDocumentId = currentUrl.split('/').pop()

      if (baseDocumentId && currentUrl.includes('/documents/')) {
        const newUrl = `/documents/${baseDocumentId}?documentId=${selectedId}`
        window.dispatchEvent(
          new CustomEvent('documentChanging', {
            detail: { documentId: selectedId },
          }),
        )
        window.history.pushState({}, '', newUrl)
        setTimeout(() => {
          window.dispatchEvent(new Event('documentChanged'))
        }, 50)
      } else {
        console.log('Navigating to document:', selectedId)
        onPrimaryAction?.(item)
      }
    }
  }

  const handlePrimaryAction = (item: TreeItem) => {
    console.log('🎯 Primary action requested:', item.index)

    // Store the pending action with timestamp
    pendingActionRef.current = { item, timestamp: Date.now() }

    // Wait for potential double click
    setTimeout(() => {
      // Only execute if this is still the most recent pending action and no double click occurred
      if (
        pendingActionRef.current?.item.index === item.index &&
        Date.now() - pendingActionRef.current.timestamp >= 200 &&
        !hasRecentDoubleClickRef.current
      ) {
        console.log('✨ Executing primary action after delay')
        executePrimaryAction(item)
        pendingActionRef.current = null
      } else {
        console.log('❌ Primary action cancelled')
      }
    }, 200)
  }

  const handleDrop = async (draggedItems: TreeItem[], position: DraggingPosition) => {
    await handleMove({ draggedItems, position, items, onMove })
  }

  const handleExpandItem = (item: TreeItem) => {
    const newExpandedItems = [...expandedItems, item.index]
    setExpandedItems(newExpandedItems)
    if (persistExpanded) {
      try {
        localStorage.setItem('editor-tree-expanded', JSON.stringify(newExpandedItems))
      } catch (e) {
        console.error('Error reading from localStorage:', e)
      }
    }
  }

  const handleCollapseItem = (item: TreeItem) => {
    const newExpandedItems = expandedItems.filter(expandedItemIndex => expandedItemIndex !== item.index)
    setExpandedItems(newExpandedItems)
    if (persistExpanded) {
      try {
        localStorage.setItem('editor-tree-expanded', JSON.stringify(newExpandedItems))
      } catch (e) {
        console.error('Error saving to localStorage:', e)
      }
    }
  }

  const handleDoubleClick = (item: TreeItem) => {
    console.log('🔥 Double click detected:', item.index)

    // Clear any pending actions
    pendingActionRef.current = null

    // Set the double click flag immediately
    hasRecentDoubleClickRef.current = true

    const selectedId = item.index.toString()
    if (!selectedId || !items[selectedId]) return

    const treeItem = items[selectedId]

    // For folders, just toggle expansion
    if (treeItem.isFolder) {
      if (expandedItems.includes(selectedId)) {
        handleCollapseItem(item)
      } else {
        handleExpandItem(item)
      }
    }

    // Reset the double click flag after a delay
    setTimeout(() => {
      console.log('🔄 Resetting double click state')
      hasRecentDoubleClickRef.current = false
    }, 1000)
  }

  const handleRename = (item: TreeItem, newName: string) => {
    console.log('Renaming item:', item.index, 'to:', newName)
    // Here you would typically make an API call to rename the item
    // For now we'll just log it
  }

  const handleStartEdit = (itemId: string, element: HTMLElement) => {
    // Find the text element for positioning
    const textElement = element.querySelector('[data-label-content]')
    if (!textElement) return

    // Get the exact position and dimensions
    const textRect = textElement.getBoundingClientRect()
    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft

    // Position the input exactly where the text element is
    editPositionRef.current = {
      top: textRect.top + scrollTop,
      left: textRect.left + scrollLeft,
      width: element.clientWidth - (textRect.left - element.getBoundingClientRect().left) - 8,
    }

    setEditingItem(itemId)
    setEditValue(items[itemId].data)

    // Focus and move cursor to end without selecting
    setTimeout(() => {
      if (floatingInputRef.current) {
        floatingInputRef.current.focus()
        const length = floatingInputRef.current.value.length
        floatingInputRef.current.setSelectionRange(length, length)
      }
    }, 0)
  }

  const handleEditComplete = (save: boolean) => {
    if (editingItem && save && editValue.trim() !== '') {
      handleRename({ index: editingItem } as TreeItem, editValue.trim())
    }
    setEditingItem(null)
    setEditValue('')
    editPositionRef.current = null
  }

  return (
    <div className={`relative [&_.rct-tree-root-focus]:!outline-none ${className}`} style={style}>
      {editingItem && editPositionRef.current && (
        <input
          ref={floatingInputRef}
          type="text"
          value={editValue}
          className={`fixed z-50 block h-[20px] w-full cursor-text overflow-hidden whitespace-nowrap bg-transparent text-sm font-[600] font-semibold uppercase leading-[20px] tracking-wide outline-none ${
            theme === 'light' ? 'text-black/[.70]' : 'text-black/[.70]'
          }`}
          style={{
            top: `${editPositionRef.current.top}px`,
            left: `${editPositionRef.current.left}px`,
            width: `${editPositionRef.current.width}px`,
            caretColor: theme === 'light' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.7)',
            fontSize: '14px',
            fontWeight: '600',
            letterSpacing: '0.35px',
            lineHeight: '20px',
            height: '20px',
            padding: '0px',
            margin: '0px',
            fontFamily: 'sans-serif',
            textTransform: 'uppercase',
            minWidth: '0',
            maxWidth: '100%',
          }}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleEditComplete(true)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              handleEditComplete(false)
            }
          }}
          onBlur={() => handleEditComplete(true)}
        />
      )}
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
          -webkit-tap-highlight-color: transparent;
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
          border-color: transparent !important;
          box-shadow: none !important;
        }
        *:focus-visible {
          outline: none !important;
          border-color: transparent !important;
          box-shadow: none !important;
        }
        .rct-tree-item {
          outline: none !important;
        }
        .rct-tree-item-title {
          outline: none !important;
        }
        .rct-tree-item-arrow {
          outline: none !important;
        }
        .rct-tree-root {
          outline: none !important;
        }
        .rct-tree-root-focus {
          outline: none !important;
        }
        .rct-tree-item-title-container-focused {
          outline: none !important;
          border-color: transparent !important;
        }
        .rct-tree-item-title-container-selected {
          background-color: transparent !important;
        }
        /* Additional focus-visible overrides */
        .rct-tree-item-title-container:focus-visible,
        .rct-tree-item-button:focus-visible,
        .rct-tree-item:focus-visible,
        .rct-tree-root:focus-visible,
        .rct-tree-item-title:focus-visible,
        .rct-tree-item-arrow:focus-visible {
          outline: none !important;
          border-color: transparent !important;
          box-shadow: none !important;
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
            focusedItem: selectedItems?.[0],
            expandedItems,
            selectedItems,
          },
        }}
        onFocusItem={item => {
          if (item && onSelectedItemsChange) {
            onSelectedItemsChange([item.index])
          }
        }}
        onExpandItem={handleExpandItem}
        onCollapseItem={handleCollapseItem}
        onSelectItems={handleSelect}
        onPrimaryAction={handlePrimaryAction}
        onDrop={handleDrop}
        canDragAndDrop={true}
        canDropOnFolder={true}
        canReorderItems={true}
        canSearch={false}
        renderItem={props => {
          const { item, depth, arrow, context } = props
          const isFolder = Boolean(item.isFolder)

          return (
            <ListItem
              depth={depth}
              label={item.data}
              isSelected={context.isSelected}
              isExpanded={context.isExpanded}
              leftIcon={isFolder ? arrow : null}
              theme={theme}
              showSelectedStyles={showSelectedStyles}
              isEditing={editingItem === item.index.toString()}
              onStartEdit={() => {
                const element = document.querySelector(`[data-item-id="${item.index}"]`)
                if (element instanceof HTMLElement) {
                  handleStartEdit(item.index.toString(), element)
                }
              }}
              onClick={() => {
                if (isFolder) {
                  if (context.isExpanded) {
                    handleCollapseItem(item)
                  } else {
                    handleExpandItem(item)
                  }
                } else {
                  handlePrimaryAction(item)
                }
              }}
              onDoubleClick={() => handleDoubleClick(item)}
              rightContent={
                showActionButton && item.index !== 'root' ? (
                  <IconButton
                    size="small"
                    onClick={e => {
                      e.stopPropagation()
                      if (onActionButtonClick) {
                        onActionButtonClick(e, item.index.toString())
                      }
                    }}
                    className="hover:bg-black/[.10]">
                    <MoreHorizIcon fontSize="small" />
                  </IconButton>
                ) : null
              }
              containerProps={props.context.itemContainerWithChildrenProps}
              itemContainerProps={
                {
                  ...props.context.itemContainerWithoutChildrenProps,
                  ...context.interactiveElementProps,
                  'data-item-id': item.index.toString(),
                } as React.HTMLAttributes<HTMLDivElement>
              }>
              {props.children}
            </ListItem>
          )
        }}>
        <Tree treeId="tree-1" rootItem="root" />
      </ControlledTreeEnvironment>
    </div>
  )
}

export default DocumentTree
