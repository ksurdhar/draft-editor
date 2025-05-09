import { DocumentData, FolderData } from '@typez/globals'

export interface DocumentOperations {
  patchDocument: (id: string, data: any) => Promise<any>
  patchFolder: (id: string, data: any) => Promise<any>
  bulkDeleteItems: (documentIds: string[], folderIds: string[]) => Promise<any>
  createDocument: (data: any) => Promise<any>
  renameItem: (
    itemId: string,
    newName: string,
    docs: DocumentData[],
    folders: FolderData[],
    operations: DocumentOperations,
    onUpdate: (updatedDocs: DocumentData[], updatedFolders: FolderData[]) => void,
  ) => Promise<void>
}

export const calculateMoveUpdates = (
  itemId: string,
  targetFolderId: string | undefined,
  targetIndex: number | undefined,
  docs: DocumentData[],
  folders: FolderData[],
) => {
  // Get all items in the target folder
  const folderItems = [
    ...docs
      .filter(d => {
        if (!targetFolderId) return !d.parentId || d.parentId === 'root'
        return d.parentId === targetFolderId
      })
      .map(doc => ({ ...doc, isDocument: true })),
    ...folders
      .filter(f => {
        if (!targetFolderId) return !f.parentId || f.parentId === 'root'
        return f.parentId === targetFolderId
      })
      .map(folder => ({ ...folder, isDocument: false })),
  ].sort((a, b) => (a.folderIndex || 0) - (b.folderIndex || 0))

  // Remove the moved item from the list if it's already in this folder
  const filteredItems = folderItems.filter(item => item._id !== itemId)

  // Get the moved item
  const movedDoc = docs.find(d => d._id === itemId)
  const movedItem = movedDoc
    ? { ...movedDoc, isDocument: true }
    : { ...folders.find(f => f._id === itemId)!, isDocument: false }

  if (!movedItem) {
    throw new Error(`Could not find item to move: ${itemId}`)
  }

  // Insert the moved item at the target position
  filteredItems.splice(targetIndex || 0, 0, movedItem)

  // Create updates with sequential indices
  const updates = filteredItems.map((item, index) => ({
    id: item._id,
    isDocument: item.isDocument,
    folderIndex: index,
  }))

  return {
    movedDoc,
    updates,
  }
}

export const moveItem = async (
  itemId: string,
  targetFolderId: string | undefined,
  targetIndex: number | undefined,
  docs: DocumentData[],
  folders: FolderData[],
  operations: DocumentOperations,
  onUpdateState: (updatedDocs: DocumentData[], updatedFolders: FolderData[]) => void,
) => {
  try {
    const { movedDoc, updates } = calculateMoveUpdates(itemId, targetFolderId, targetIndex, docs, folders)

    // Apply optimistic updates
    const optimisticDocs = docs.map(doc => {
      const update = updates.find(u => u.id === doc._id && u.isDocument)
      if (doc._id === itemId) {
        return { ...doc, parentId: targetFolderId || 'root', folderIndex: targetIndex || 0 }
      }
      return update ? { ...doc, folderIndex: update.folderIndex } : doc
    })

    const optimisticFolders = folders.map(folder => {
      const update = updates.find(u => u.id === folder._id && !u.isDocument)
      if (folder._id === itemId) {
        return { ...folder, parentId: targetFolderId || 'root', folderIndex: targetIndex || 0 }
      }
      return update ? { ...folder, folderIndex: update.folderIndex } : folder
    })

    // Update UI optimistically
    onUpdateState(optimisticDocs, optimisticFolders)

    // First update the moved item's parent and position
    const patchOperation = movedDoc ? operations.patchDocument : operations.patchFolder

    await patchOperation(itemId, {
      parentId: targetFolderId || 'root',
      folderIndex: targetIndex || 0,
      lastUpdated: Date.now(),
    })

    console.log('updates', updates)

    // Then update all other items' positions
    await Promise.all(
      updates.map(async ({ id, isDocument, folderIndex }) => {
        if (id === itemId) return // Skip the moved item as we already updated it
        const patchOperation = isDocument ? operations.patchDocument : operations.patchFolder
        await patchOperation(id, {
          folderIndex,
          lastUpdated: Date.now(),
        })
      }),
    )
  } catch (error) {
    console.error('Error during move operation:', error)
    throw error
  }
}

export const bulkDelete = async (
  documentIds: string[],
  folderIds: string[],
  docs: DocumentData[],
  folders: FolderData[],
  operations: DocumentOperations,
  onUpdateState: (updatedDocs: DocumentData[], updatedFolders: FolderData[]) => void,
) => {
  try {
    // Optimistically update UI
    const updatedDocs = docs.filter(doc => !documentIds.includes(doc._id))
    const updatedFolders = folders.filter(folder => !folderIds.includes(folder._id))
    onUpdateState(updatedDocs, updatedFolders)

    // Make API call
    await operations.bulkDeleteItems(documentIds, folderIds)
  } catch (error) {
    console.error('Error in bulk delete:', error)
    throw error
  }
}

export const createDocument = async (
  userId: string,
  operations: DocumentOperations,
  onSuccess: (docId: string) => void,
) => {
  try {
    console.log('\n=== Creating Document ===')
    console.log('Initial data:', { userId })

    const response = await operations.createDocument({
      userId,
      title: 'Untitled',
    })
    console.log('Create document response:', response)

    // Handle both direct response and response.data patterns
    const data = response.data || response
    console.log('Processed response data:', data)

    const docId = data._id || data.id
    if (!docId) {
      throw new Error('No document ID in response: ' + JSON.stringify(data))
    }

    console.log('Successfully created document with ID:', docId)
    onSuccess(docId)
    return docId
  } catch (error) {
    console.error('Error creating document:', error)
    throw error
  }
}

export async function renameItem(
  itemId: string,
  newName: string,
  docs: DocumentData[],
  folders: FolderData[],
  operations: DocumentOperations,
  onUpdate: (updatedDocs: DocumentData[], updatedFolders: FolderData[]) => void,
  options?: {
    currentDocumentId?: string
    setHybridDoc?: (updater: (prev: any) => any) => void
    setCurrentContent?: (content: any) => void
  },
): Promise<void> {
  const isFolder = folders.some(folder => (folder._id || folder.id) === itemId)

  try {
    // Update the title in the database
    if (isFolder) {
      await operations.patchFolder(itemId, { title: newName, lastUpdated: Date.now() })
      const updatedFolders = folders.map(folder =>
        (folder._id || folder.id) === itemId
          ? { ...folder, title: newName, lastUpdated: Date.now() }
          : folder,
      )
      onUpdate(docs, updatedFolders)
    } else {
      await operations.patchDocument(itemId, { title: newName, lastUpdated: Date.now() })
      const updatedDocs = docs.map(doc =>
        (doc._id || doc.id) === itemId ? { ...doc, title: newName, lastUpdated: Date.now() } : doc,
      )
      onUpdate(updatedDocs, folders)

      // If this is the current document, update all relevant state
      if (options?.currentDocumentId === itemId) {
        // Update hybrid doc state
        if (options.setHybridDoc) {
          options.setHybridDoc(prev => (prev ? { ...prev, title: newName } : prev))
        }

        // Update current content with new title
        if (options.setCurrentContent) {
          options.setCurrentContent((prev: any) => {
            if (!prev) return prev
            const content = typeof prev === 'string' ? JSON.parse(prev) : prev
            return { ...content, title: newName }
          })
        }

        // Update session storage
        const cachedDoc = JSON.parse(sessionStorage.getItem(itemId) || '{}')
        if (Object.keys(cachedDoc).length > 0) {
          sessionStorage.setItem(itemId, JSON.stringify({ ...cachedDoc, title: newName }))
        }
      }
    }
  } catch (error) {
    console.error('Failed to rename item:', error)
    throw error
  }
}
