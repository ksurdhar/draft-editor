'use client'

import { fetcher } from '@lib/http-utils'
import { DocumentData } from '@typez/globals'
import { useUser } from '@wrappers/auth-wrapper-client'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Fragment, useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useAPI, useMouse, useNavigation } from './providers'

import { useSyncHybridDoc } from '@lib/hooks'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
const ShareModal = dynamic(() => import('./share-modal'))
const VersionModal = dynamic(() => import('./version-modal'))

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
  documentId: string
}

const HeaderComponent = ({ documentId }: HeaderProps) => {
  const { user } = useUser()
  const { navigateTo } = useNavigation()
  const { post } = useAPI()

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
    mutate(`/api/documents/${documentId}/versions`)
    setIsVersionModalOpen(true)
  }
  const closeVersionModal = () => setIsVersionModalOpen(false)

  const { mouseMoved, hoveringOverMenu } = useMouse()
  const [initFadeIn, fadeOut] = useEditorFades(!mouseMoved)

  const { data: databaseDoc } = useSWR<DocumentData, Error>(`/api/documents/${documentId}`, fetcher)
  const [hybridDoc, setHybridDoc] = useState<DocumentData | null>()
  useSyncHybridDoc(documentId, databaseDoc, setHybridDoc)

  const isOwner = user && hybridDoc && hybridDoc.userId === user.sub

  return (
    <>
      <header
        className={`${initFadeIn ? 'header-gradient' : 'bg-transparent'} ${
          fadeOut && !menuOpen ? 'opacity-0' : 'opacity-100'
        } fixed top-0 z-[39] flex w-[100vw] flex-row justify-between p-5 pb-[30px] transition-opacity duration-700 hover:opacity-100`}>
        <h1 className="lowercase">
          <Link href={'/'}>Whetstone</Link>
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
                        console.log('kiran', user?.sub)
                        const res = await post(`/api/documents`, { userId: user?.sub })
                        const documentId = res.data.id
                        navigateTo(`/documents/${documentId}`)
                      } catch (e) {
                        console.log(e)
                      }
                    }}>
                    <ListItemText primary={'Create Document'} sx={{ fontFamily: 'Mukta' }} />
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
                  <Link href="/api/auth/logout">
                    <ListItemButton>
                      <ListItemText primary={'Sign Out'} />
                    </ListItemButton>
                  </Link>
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
