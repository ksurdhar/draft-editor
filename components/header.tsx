'use client'

import { useUser } from '@wrappers/auth-wrapper-client'
import { Fragment, useEffect, useState, useRef } from 'react'
import { mutate } from 'swr'
import { useAPI, useMouse, useNavigation } from './providers'
import { useFolderSync } from '@lib/hooks'
import { importFiles } from '@lib/import-utils'
import { Divider, List, ListItem, ListItemButton, ListItemText } from '@mui/material'
import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'

// Direct detection method for Electron environment
const isBrowser = typeof window !== 'undefined'
const isElectron = isBrowser && window.hasOwnProperty('electronAPI')

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

interface HeaderComponentProps {
  isChatOpen?: boolean
  chatPanelSize?: number
}

const HeaderComponent = ({ isChatOpen = false, chatPanelSize = 0 }: HeaderComponentProps) => {
  const { user } = useUser()
  const { navigateTo, signOut } = useNavigation()
  const { post } = useAPI()
  const { mutate: mutateFolders } = useFolderSync()

  // const fetcher = useCallback(
  //   async (path: string) => {
  //     return await get(path)
  //   },
  //   [get],
  // )

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

  // const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  // const openShareModal = () => setIsShareModalOpen(true)
  // const closeShareModal = () => setIsShareModalOpen(false)

  const { mouseMoved, hoveringOverMenu } = useMouse()
  const [initFadeIn, fadeOut] = useEditorFades(!mouseMoved)

  // const documentPath = `/documents/${id}`

  // const { data: databaseDoc } = useSWR<DocumentData, Error>(documentPath, fetcher)
  // const [hybridDoc, setHybridDoc] = useState<DocumentData | null>()

  // useSyncHybridDoc(id, databaseDoc, setHybridDoc)
  // useEffect(() => {
  //   if (databaseDoc) {
  //     setHybridDoc(databaseDoc)
  //   }
  // }, [databaseDoc])

  // const isOwner = user && hybridDoc && hybridDoc.userId === user.sub

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || !user?.sub) return

    try {
      await importFiles(files, user.sub, { post }, () => {
        Promise.all([mutate('/documents?metadataOnly=true'), mutateFolders()])
      })
    } catch (error: any) {
      console.error('Error importing files:', error)
    }

    setMenuOpen(false)
    event.target.value = ''
  }

  // Adjust the hamburger menu position for Electron
  const hamburgerTopPosition = isElectron ? 'top-[28px]' : 'top-[20px]'

  // Calculate the right position for the hamburger menu based on chat panel status
  const hamburgerRightPosition = isChatOpen ? `calc(${chatPanelSize}% + 20px)` : '20px'

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
          multiple: true,
        } as DirectoryInputProps)}
      />
      <div
        className={`${initFadeIn ? 'header-gradient' : 'bg-transparent'} ${
          fadeOut && !menuOpen ? 'opacity-0' : 'opacity-100'
        } pointer-events-none fixed left-0 top-[16px] z-[39] p-5 pb-[0px] transition-opacity duration-700 hover:opacity-100`}>
        <div className="pointer-events-auto">
          <h1 className="lowercase">
            {user ? (
              <button onClick={() => navigateTo('/documents')} className="hover:opacity-80">
                whetstone
              </button>
            ) : (
              <button onClick={() => navigateTo('/')} className="hover:opacity-80">
                whetstone
              </button>
            )}
          </h1>
        </div>
      </div>

      <div
        className={`${
          fadeOut && !hoveringOverMenu && !menuOpen ? 'opacity-0' : 'opacity-100'
        } fixed ${hamburgerTopPosition} z-50 flex flex-row-reverse transition-opacity duration-700`}
        style={{ right: hamburgerRightPosition }}>
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
                  <ListItemButton
                    onClick={() => {
                      navigateTo('/conversations')
                      setMenuOpen(!menuOpen)
                    }}>
                    <ListItemText primary={'Conversations'} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => signOut()}>
                    <ListItemText primary={'Sign Out'} />
                  </ListItemButton>
                </ListItem>
              </List>
              <Divider />
              {/* {isOwner && (
                <List>
                  <ListItem disablePadding>
                    <ListItemButton onClick={openShareModal}>
                      <ListItemText primary={'Share'} />
                    </ListItemButton>
                  </ListItem>
                </List>
              )} */}
            </Box>
          </Drawer>
          {/* {isOwner && <ShareModal open={isShareModalOpen} onClose={closeShareModal} document={hybridDoc} />} */}
        </Fragment>
      </div>
    </>
  )
}

export default HeaderComponent
