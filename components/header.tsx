import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '@auth0/nextjs-auth0'
import { useEffect, useState } from 'react'
import { useMouse } from '../pages/_app'
import Switch from '@mui/material/Switch'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { DocumentData } from '../types/globals'
import API, { fetcher, updateDoc } from '../lib/httpUtils'

import * as React from 'react'

import Box from '@mui/material/Box'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import Divider from '@mui/material/Divider'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ShareModal from './shareModal'

const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState(0)

  useEffect(() => {
    const updatePosition = () => {
      setScrollPosition(window.pageYOffset)
    }
    window.addEventListener('scroll', updatePosition)
    updatePosition()
    return () => window.removeEventListener('scroll', updatePosition)
  }, [])

  return scrollPosition
}

export const useEditorFades = (isMouseStill: boolean) => {
  const router = useRouter()
  const scrollPosition = useScrollPosition()
  const editorActive = router.pathname.includes('/documents/')
  const [ fadeHeader, setFadeHeader ] = useState(false)

  useEffect(() => {
    if (editorActive) {
      setTimeout(() => {
        setFadeHeader(true)
      }, 2000)
    }
  }, [])
  
  const initFadeIn = editorActive && fadeHeader
  const fadeOut = editorActive && isMouseStill && scrollPosition > 20

  return [initFadeIn, fadeOut]
}

type HeaderProps = {
  documentId: string
}

const HeaderComponent = ({ documentId }: HeaderProps) => {
  const { user } = useUser()
  const router = useRouter()

  const [ menuOpen, setMenuOpen ] = useState(false)

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return
    }
    setMenuOpen(open)
  }

  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false)
  const openShareModal = () => setIsShareModalOpen(true)
  const closeShareModal = () => setIsShareModalOpen(false)
  
  const { mouseMoved, hoveringOverMenu } = useMouse()
  const [ initFadeIn, fadeOut ] = useEditorFades(!mouseMoved)
  
  const { data: databaseDoc } = useSWR<DocumentData, Error>(`/api/documents/${documentId}`, fetcher) 
  const { trigger } = useSWRMutation(`/api/documents/${documentId}`, updateDoc)

  const anyoneCanView = databaseDoc?.view?.length === 0

  return (
    <>
      <header className={`${initFadeIn ? 'header-gradient' : 'bg-transparent'} ${fadeOut && !menuOpen ? 'opacity-0' : 'opacity-100'} hover:opacity-100 transition-opacity duration-700 fixed top-0 w-[100vw] z-[39] flex flex-row p-5 pb-[30px] justify-between`}>
        <h1 className='lowercase'><Link href={'/'}>Whetstone</Link></h1>
      </header>

      <div className={`${fadeOut && !hoveringOverMenu && !menuOpen ? 'opacity-0' : 'opacity-100'} transition-opacity duration-700 flex flex-row-reverse z-50 fixed right-[20px] top-[20px]`}>
        <React.Fragment>          
          <div onClick={toggleDrawer(true)} 
            className={`hamburger hamburger--spin ${ menuOpen ? 'is-active' : ''}`}>
            <span className="hamburger-box">
              <span className="hamburger-inner"></span>
            </span>
          </div>
          <Drawer
            anchor={'right'}
            open={menuOpen}
            onClose={toggleDrawer(false)}>
            <Box
              sx={{ width: 250, height: '100%', backgroundColor: '#f1f5f9', fontFamily: 'Mukta' }}
              role="presentation"
              onClick={toggleDrawer(false)}
              onKeyDown={toggleDrawer(false)}>
              <List>
              { databaseDoc && user &&
                <Switch checked={anyoneCanView} value={anyoneCanView} onChange={(event) => {
                  if (!user.email) return
                  const newVal = event.target.value
                  if (newVal === 'true') {
                    trigger({ ...databaseDoc, view: [ user.email ] })
                  } else {
                    trigger({ ...databaseDoc, view: [] })
                  }
                }} />
              }
                <ListItem disablePadding>
                  <ListItemButton onClick={async () => {
                    setMenuOpen(!menuOpen)
                    try {
                      const res = await API.post(`/api/documents`, { userId: user?.sub })
                      const documentId = res.data.id
                      router.push(`/documents/${documentId}`)
                    } catch (e) {
                      console.log(e)
                    }
                  }}>
                    <ListItemText primary={'Create Document'} sx={{ fontFamily: 'Mukta' }}/>
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => {
                    router.push('/documents')
                    setMenuOpen(!menuOpen)
                  }}>
                    <ListItemText primary={'Documents'} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <Link href='/api/auth/logout'>
                    <ListItemButton>
                      <ListItemText primary={'Sign Out'} />
                    </ListItemButton>
                  </Link>
                </ListItem>
              </List>
              <Divider />
              { databaseDoc && user &&  
                <List>
                  <ListItem disablePadding>
                    <ListItemButton onClick={openShareModal}>
                      <ListItemText primary={'Share'}/>
                    </ListItemButton>
                  </ListItem>
                </List>
              }
            </Box>
          </Drawer>
          { databaseDoc && user &&  
            <ShareModal 
              open={isShareModalOpen} 
              onClose={closeShareModal} 
              document={databaseDoc}
            />
          }
        </React.Fragment>
      </div>
    </>
  )
}

export default HeaderComponent