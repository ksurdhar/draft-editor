import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'
import { FolderData } from '@typez/globals'

async function getFolderDepth(folderId: string, cache = new Map<string, number>()): Promise<number> {
  if (cache.has(folderId)) {
    return cache.get(folderId)!
  }

  const folders = await storage.find('folders', { _id: folderId }) as FolderData[]
  const folder = folders[0]
  if (!folder || !folder.parentId || folder.parentId === 'root') {
    cache.set(folderId, 0)
    return 0
  }

  const parentDepth = await getFolderDepth(folder.parentId, cache)
  const depth = parentDepth + 1
  cache.set(folderId, depth)
  return depth
}

async function deleteFolder(folderId: string, userId: string, deletedFolders = new Set<string>()) {
  // Skip if already deleted
  if (deletedFolders.has(folderId)) {
    return true
  }

  
  // Get all documents and subfolders in this folder
  const [docs, subfolders] = await Promise.all([
    storage.find('documents', { parentId: folderId }),
    storage.find('folders', { parentId: folderId }) as Promise<FolderData[]>
  ])

  // Delete all documents in this folder
  if (docs.length > 0) {
    await Promise.all(
      docs.map(doc => storage.delete('documents', { _id: doc._id, userId }))
    )
  }

  // Delete all subfolders
  if (subfolders.length > 0) {
    for (const folder of subfolders) {
      if (!folder._id) continue
      await deleteFolder(folder._id, userId, deletedFolders)
    }
  }

  // Delete the folder itself
  let result = await storage.delete('folders', { _id: folderId, userId })
  
  if (!result) {
    result = await storage.delete('folders', { _id: folderId, userId: 'current' })
  }
  
  if (!result) {
    throw new Error(`Failed to delete folder ${folderId}`)
  }

  deletedFolders.add(folderId)
  return result
}

export default withHybridAuth(async function bulkDeleteHandler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { method, user, body } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  if (method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    res.status(405).end(`Method ${method} Not Allowed`)
    return
  }

  const { documentIds, folderIds } = body

  if (!Array.isArray(documentIds) || !Array.isArray(folderIds)) {
    
    return res.status(400).json({ error: 'Invalid request body' })
  }

  try {
    // Delete all documents first
    if (documentIds.length > 0) {
      await Promise.all(
        documentIds.map(async id => {
          try {
            const result = await storage.delete('documents', { _id: id, userId: user.sub })
            
            if (!result) {
              throw new Error(`Document not found or unauthorized: ${id}`)
            }
            return result
          } catch (err) {
            console.error(`Error deleting document ${id}:`, err)
            throw err
          }
        })
      )
    }

    // Delete folders in order of depth (deepest first)
    if (folderIds.length > 0) {
      
      // Get depths for all folders
      const folderDepths = await Promise.all(
        folderIds.map(async id => ({
          id,
          depth: await getFolderDepth(id)
        }))
      )

      // Sort by depth (deepest first)
      const sortedFolders = folderDepths.sort((a, b) => b.depth - a.depth)
      
      // Delete folders sequentially
      const deletedFolders = new Set<string>()
      for (const { id } of sortedFolders) {
        try {
          await deleteFolder(id, user.sub, deletedFolders)
        } catch (err) {
          console.error(`Error deleting folder ${id}:`, err)
          throw err
        }
      }
    }
    res.status(200).json({ success: true })
  } catch (error: any) {
    console.error('Bulk delete error:', error)
    res.status(500).json({ 
      error: 'Failed to delete items',
      details: error.message || 'Unknown error occurred'
    })
  }
}) 