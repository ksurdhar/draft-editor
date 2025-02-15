/**
 * Utilities for importing text files and folders into the application.
 * 
 * This module provides functionality to:
 * 1. Import an entire directory structure of text files
 * 2. Recreate the folder hierarchy in the application
 * 3. Convert plain text files into Tiptap-compatible documents
 * 
 * The import process:
 * - Accepts a FileList (usually from a directory input)
 * - Groups files by their directory structure
 * - Creates folders maintaining the original hierarchy
 * - Converts text content to Tiptap format
 * - Creates documents in their respective folders
 * 
 * Note: Currently supports .txt files only, skips .DS_Store files
 */

import { transformTextToTiptap } from './transforms/text-to-tiptap'

interface FileImportAPI {
  post: (path: string, body: any) => Promise<any>
}

interface FilesByDirectory {
  [key: string]: File[]
}

export async function importFiles(
  files: FileList,
  userId: string,
  api: FileImportAPI,
  onComplete?: () => void
) {
  // Group files by their directory structure
  const filesByDirectory: FilesByDirectory = {}
  
  Array.from(files).forEach(file => {
    if (file.name === '.DS_Store') return
    
    const path = file.webkitRelativePath
    const dirPath = path.split('/').slice(0, -1).join('/')
    
    if (!filesByDirectory[dirPath]) {
      filesByDirectory[dirPath] = []
    }
    filesByDirectory[dirPath].push(file)
  })

  // Create folders first
  const folderPaths = Object.keys(filesByDirectory)
  const folderMap = new Map<string, string>() // Maps path to folder ID
  
  for (const fullPath of folderPaths) {
    const pathParts = fullPath.split('/')
    // Skip the root folder (usually the selected folder name)
    pathParts.shift()
    
    let parentId: string | undefined = undefined
    let currentPath = ''
    
    // Create each folder in the path if it doesn't exist
    for (const part of pathParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      
      if (!folderMap.has(currentPath)) {
        const response = await api.post('/folders', {
          title: part,
          parentId,
          userId,
          lastUpdated: Date.now()
        })
        folderMap.set(currentPath, response._id)
      }
      parentId = folderMap.get(currentPath)
    }
  }

  // Create documents
  for (const [dirPath, dirFiles] of Object.entries(filesByDirectory)) {
    const pathParts = dirPath.split('/')
    pathParts.shift() // Remove root folder
    const folderPath = pathParts.join('/')
    const parentId = folderMap.get(folderPath)

    for (const file of dirFiles) {
      const content = await file.text()
      const transformedContent = JSON.stringify(transformTextToTiptap(content))

      await api.post('/documents', {
        title: file.name.replace('.txt', ''),
        content: transformedContent,
        parentId,
        userId,
        lastUpdated: Date.now()
      })
    }
  }

  onComplete?.()
} 