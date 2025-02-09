'use client'

import { DocumentData } from '@typez/globals'
import { useUser } from '@wrappers/auth-wrapper-client'
import Link from 'next/link'
import { Fragment, useCallback, useEffect, useState, useRef } from 'react'
import useSWR, { mutate } from 'swr'
import { useAPI, useMouse, useNavigation } from './providers'

import { useSyncHybridDoc } from '@lib/hooks'
import { Divider, List, ListItem, ListItemButton, ListItemText } from '@mui/material'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import ShareModal from './share-modal'
import VersionModal from './version-modal'

interface DirectoryInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  webkitdirectory?: string
  directory?: string
}

const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState(0)

  useEffect(() => {
    const editorContainer = document.getElementById('editor-container')
    if (!editorContainer) return

    const updatePosition = () => {
      setScrollPosition(editorContainer.scrollTop)
    }

    editorContainer.addEventListener('scroll', updatePosition)
    updatePosition()
    return () => editorContainer.removeEventListener('scroll', updatePosition)
  }, [])

  return scrollPosition
}

export const useEditorFades = (isMouseStill: boolean) => {
  const { getLocation } = useNavigation()
  const pathname = getLocation()
  const scrollPosition = useScrollPosition()
  const editorActive = (pathname || '').includes('/documents/')
  const [fadeHeader, setFadeHeader] = useState(false)

  useEffect(() => {
    if (editorActive) {
      setTimeout(() => {
        setFadeHeader(true)
      }, 2000)
    }
  }, [editorActive])

  const initFadeIn = editorActive && fadeHeader
  const fadeOut = editorActive && isMouseStill && scrollPosition > 20 && false
  // currently disabled because its kinda annoying

  return [initFadeIn, fadeOut]
}

type HeaderProps = {
  id: string
}

const HeaderComponent = ({ id }: HeaderProps) => {
  const { user } = useUser()
  const { navigateTo, signOut } = useNavigation()
  const { post, get } = useAPI()

  const fetcher = useCallback(
    async (path: string) => {
      return await get(path)
    },
    [get],
  )

  const [menuOpen, setMenuOpen] = useState(false)
  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' || (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return
    }
    setMenuOpen(open)
  }

  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const openShareModal = () => setIsShareModalOpen(true)
  const closeShareModal = () => setIsShareModalOpen(false)

  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false)
  const openVersionModal = () => {
    mutate(`/documents/${id}/versions`)
    setIsVersionModalOpen(true)
  }
  const closeVersionModal = () => setIsVersionModalOpen(false)

  const { mouseMoved, hoveringOverMenu } = useMouse()
  const [initFadeIn, fadeOut] = useEditorFades(!mouseMoved)

  const documentPath = `/documents/${id}`

  const { data: databaseDoc } = useSWR<DocumentData, Error>(documentPath, fetcher)
  const [hybridDoc, setHybridDoc] = useState<DocumentData | null>()
  useSyncHybridDoc(id, databaseDoc, setHybridDoc)

  const isOwner = user && hybridDoc && hybridDoc.userId === user.sub

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    // Group files by their directory structure
    const filesByDirectory: { [key: string]: File[] } = {}
    
    Array.from(files).forEach(file => {
      // Skip .DS_Store files
      if (file.name === '.DS_Store') return
      
      const path = file.webkitRelativePath
      // Get the directory path without the filename
      const dirPath = path.split('/').slice(0, -1).join('/')
      
      if (!filesByDirectory[dirPath]) {
        filesByDirectory[dirPath] = []
      }
      filesByDirectory[dirPath].push(file)
    })

    try {
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
            const response = await post('/folders', {
              title: part,
              parentId,
              userId: user?.sub,
              lastUpdated: Date.now()
            })
            folderMap.set(currentPath, response._id)
          }
          parentId = folderMap.get(currentPath)
        }
      }

      // Create documents
      for (const [dirPath, files] of Object.entries(filesByDirectory)) {
        const pathParts = dirPath.split('/')
        pathParts.shift() // Remove root folder
        const folderPath = pathParts.join('/')
        const parentId = folderMap.get(folderPath)

        for (const file of files) {
          const content = await file.text()
          const transformedContent = JSON.stringify([{
            type: 'default',
            children: content.split('\n').map(line => ({
              text: line,
              highlight: 'none'
            }))
          }])

          await post('/documents', {
            title: file.name.replace('.txt', ''),
            content: transformedContent,
            parentId,
            userId: user?.sub,
            lastUpdated: Date.now()
          })
        }
      }

      // Refresh the documents list
      mutate('/documents')
    } catch (error) {
      console.error('Error importing files:', error)
    }
    
    setMenuOpen(false)
    // Reset input so the same file can be selected again
    event.target.value = ''
  }

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        {...({
          webkitdirectory: '',
          directory: '',
          multiple: true
        } as DirectoryInputProps)}
      />
      <header
        className={`${initFadeIn ? 'header-gradient' : 'bg-transparent'} ${
          fadeOut && !menuOpen ? 'opacity-0' : 'opacity-100'
        } fixed top-0 z-[39] flex w-[100vw] flex-row justify-between p-5 pb-[30px] transition-opacity duration-700 hover:opacity-100`}>
        <h1 className="lowercase">
          {user ? (
            <Link href={'/documents'}>Whetstone</Link>
          ) : (
            <Link href={'/'}>Whetstone</Link>
          )}
        </h1>
      </header>

      <div
        className={`${
          fadeOut && !hoveringOverMenu && !menuOpen ? 'opacity-0' : 'opacity-100'
        } fixed right-[20px] top-[20px] z-50 flex flex-row-reverse transition-opacity duration-700`}>
        <Fragment>
          <div
            onClick={toggleDrawer(true)}
            className={`hamburger hamburger--spin ${menuOpen ? 'is-active' : ''}`}>
            <span className="hamburger-box">
              <span className="hamburger-inner"></span>
            </span>
          </div>
          <Drawer anchor={'right'} open={menuOpen} onClose={toggleDrawer(false)}>
            <Box
              sx={{ width: 250, height: '100%', backgroundColor: '#f1f5f9', fontFamily: 'Mukta' }}
              role="presentation"
              onClick={toggleDrawer(false)}
              onKeyDown={toggleDrawer(false)}>
              <List>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={async () => {
                      setMenuOpen(!menuOpen)
                      try {
                        const response = await post(`/documents`, { userId: user?.sub })
                        const docId = response._id || response.id
                        if (!docId) {
                          console.error('No document ID in response:', response)
                          return
                        }
                        navigateTo(`/documents/${docId}`)
                      } catch (e) {
                        console.error('Error creating document:', e)
                      }
                    }}>
                    <ListItemText primary={'Create Document'} sx={{ fontFamily: 'Mukta' }} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={handleImport}>
                    <ListItemText primary={'Import Folder'} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton
                    onClick={() => {
                      navigateTo('/documents')
                      setMenuOpen(!menuOpen)
                    }}>
                    <ListItemText primary={'Documents'} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => signOut()}>
                    <ListItemText primary={'Sign Out'} />
                  </ListItemButton>
                </ListItem>
              </List>
              <Divider />
              {isOwner && (
                <List>
                  <ListItem disablePadding>
                    <ListItemButton onClick={openShareModal}>
                      <ListItemText primary={'Share'} />
                    </ListItemButton>
                  </ListItem>
                  <ListItem disablePadding>
                    <ListItemButton onClick={openVersionModal}>
                      <ListItemText primary={'Versions'} />
                    </ListItemButton>
                  </ListItem>
                </List>
              )}
            </Box>
          </Drawer>
          {isOwner && <ShareModal open={isShareModalOpen} onClose={closeShareModal} document={hybridDoc} />}
          {isOwner && (
            <VersionModal open={isVersionModalOpen} onClose={closeVersionModal} document={hybridDoc} />
          )}
        </Fragment>
      </div>
    </>
  )
}

export default HeaderComponent
