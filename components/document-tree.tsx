import { ControlledTreeEnvironment, Tree, TreeItemIndex, TreeItem, DraggingPosition } from 'react-complex-tree'
import 'react-complex-tree/lib/style.css'
import { IconButton } from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { useState } from 'react'
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

export const createTreeItems = (docs: DocumentData[], folders: FolderData[]): Record<string, TreeItemData> => {
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
      folderIndex: folder.folderIndex
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
      folderIndex: doc.folderIndex
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
  showSelectedStyles = true
}: DocumentTreeProps) => {
  const [internalSelectedItems, setInternalSelectedItems] = useState<TreeItemIndex[]>([])
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

  // Use either external or internal selected items
  const selectedItems = externalSelectedItems !== undefined ? externalSelectedItems : internalSelectedItems

  const handleSelect = (items: TreeItemIndex[]) => {
    if (onSelectedItemsChange) {
      onSelectedItemsChange(items)
    } else {
      setInternalSelectedItems([...items])
    }
  }

  const handlePrimaryAction = (item: TreeItem) => {
    const selectedId = item.index.toString()
    if (!selectedId || !items[selectedId]) return

    const treeItem = items[selectedId]
    if (!treeItem.isFolder) {
      const currentUrl = window.location.pathname
      const baseDocumentId = currentUrl.split('/').pop()
      
      if (baseDocumentId && currentUrl.includes('/documents/')) {
        const newUrl = `/documents/${baseDocumentId}?documentId=${selectedId}`
        window.history.pushState({}, '', newUrl)
        // Dispatch custom event for document change
        window.dispatchEvent(new Event('documentChanged'))
      } else {
        console.log('Navigating to document:', selectedId)
        onPrimaryAction?.(item)
      }
    }
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
        console.error('Error saving to localStorage:', e)
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

  return (
    <div className={`[&_.rct-tree-root-focus]:!outline-none ${className}`} style={style}>
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
            focusedItem: undefined,
            expandedItems,
            selectedItems,
          }
        }}
        onFocusItem={() => {
          // Prevent focus from being set
          return
        }}
        onExpandItem={handleExpandItem}
        onCollapseItem={handleCollapseItem}
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
            <ListItem
              depth={depth}
              label={item.data}
              isSelected={context.isSelected}
              isExpanded={context.isExpanded}
              leftIcon={isFolder ? arrow : null}
              theme={theme}
              showSelectedStyles={showSelectedStyles}
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
                    className="hover:bg-black/[.10]"
                  >
                    <MoreHorizIcon fontSize="small" />
                  </IconButton>
                ) : null
              }
              containerProps={props.context.itemContainerWithChildrenProps}
              itemContainerProps={{
                ...props.context.itemContainerWithoutChildrenProps,
                ...context.interactiveElementProps
              }}
            >
              {props.children}
            </ListItem>
          )
        }}
      >
        <Tree 
          treeId="tree-1" 
          rootItem="root"
        />
      </ControlledTreeEnvironment>
    </div>
  )
}

export default DocumentTree 