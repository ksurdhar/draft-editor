import withHybridAuth, { ExtendedApiRequest } from '@lib/with-hybrid-auth'
import type { NextApiResponse } from 'next'
import { storage } from '@lib/storage'

async function deleteFolder(folderId: string, userId: string) {
  console.log(`Starting to delete folder ${folderId} for user ${userId}`)
  
  // Get all documents and subfolders in this folder
  const [docs, subfolders] = await Promise.all([
    storage.find('documents', { parentId: folderId }),
    storage.find('folders', { parentId: folderId })
  ])

  console.log(`Found in folder ${folderId}:`, {
    documentsCount: docs.length,
    subfoldersCount: subfolders.length,
    documents: docs.map(d => d._id),
    subfolders: subfolders.map(f => f._id)
  })

  // Recursively delete all subfolders
  if (subfolders.length > 0) {
    console.log(`Deleting ${subfolders.length} subfolders of ${folderId}`)
    await Promise.all(
      subfolders.map(folder => deleteFolder(folder._id, userId))
    )
  }

  // Delete all documents in this folder
  if (docs.length > 0) {
    console.log(`Deleting ${docs.length} documents from folder ${folderId}`)
    await Promise.all(
      docs.map(doc => storage.delete('documents', { _id: doc._id, userId }))
    )
  }

  // First try to delete with the provided userId
  console.log(`Attempting to delete folder ${folderId} with userId ${userId}`)
  let result = await storage.delete('folders', { _id: folderId, userId })
  
  // If that fails, try with "current" userId
  if (!result) {
    console.log(`Retrying folder ${folderId} deletion with userId "current"`)
    result = await storage.delete('folders', { _id: folderId, userId: 'current' })
  }
  
  console.log(`Folder ${folderId} deletion result:`, result)
  if (!result) {
    throw new Error(`Failed to delete folder ${folderId}`)
  }
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
  console.log('Bulk delete request received:', {
    documentIds,
    folderIds,
    userId: user.sub
  })

  if (!Array.isArray(documentIds) || !Array.isArray(folderIds)) {
    console.log('Invalid request body:', body)
    return res.status(400).json({ error: 'Invalid request body' })
  }

  try {
    // Delete all documents
    if (documentIds.length > 0) {
      console.log(`Starting to delete ${documentIds.length} documents`)
      const docResults = await Promise.all(
        documentIds.map(async id => {
          const result = await storage.delete('documents', { _id: id, userId: user.sub })
          console.log(`Document ${id} deletion result:`, result)
          if (!result) {
            throw new Error(`Failed to delete document ${id}`)
          }
          return result
        })
      )
      console.log('Document deletion results:', docResults)
    }

    // Delete all folders recursively
    if (folderIds.length > 0) {
      console.log(`Starting to delete ${folderIds.length} folders`)
      await Promise.all(
        folderIds.map(id => deleteFolder(id, user.sub))
      )
      console.log('Finished deleting all folders')
    }

    console.log('Bulk delete operation completed successfully')
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Bulk delete error:', error)
    res.status(500).json({ error: 'Failed to delete items' })
  }
}) 