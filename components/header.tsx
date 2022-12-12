import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '@auth0/nextjs-auth0'
import { useEffect, useState } from 'react'
import API, { fetcher, updateDoc } from '../lib/utils'
import { useMouse } from '../pages/_app'
import Switch from '@mui/material/switch'
import useSWR from 'swr'
import useSWRMutation from 'swr/mutation'
import { DocumentData } from '../types/globals'

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

      {/* drawer menu */}
      <div className='fixed top-0 right-0 z-40'>
        <div className={`${router.pathname === '/documents' ? 'bg-menu' : 'bg-menu-dark'} transition-[right] ease-in-out duration-500 absolute top-0 ${menuOpen ? 'right-0' : 'right-[-500px]'} h-[100vh] min-w-[300px] 
          p-[10px] pt-[48px] text-[20px] text-white z-30`}>
            {
              databaseDoc && user &&
              <Switch checked={anyoneCanView} value={anyoneCanView} onChange={(event) => {
                if (!user.email) return
                const newVal = event.target.value
                if (newVal == 'true') {
                  trigger({ ...databaseDoc, view: [ user.email ] })
                } else {
                  trigger({ ...databaseDoc, view: [] })
                }
              }} />
            }
            

          <div className={'hover:bg-white/[.3] cursor-pointer p-2 px-[20px] pl-[26px]'}
            onClick={async () => {
              setMenuOpen(!menuOpen)
              try {
                const res = await API.post(`/api/documents`, { userId: user?.sub })
                const documentId = res.data.id
                router.push(`/documents/${documentId}`)
              } catch (e) {
                console.log(e)
              }
            }}>
            Create Document
          </div>
          <div className={'hover:bg-white/[.3] cursor-pointer p-2 px-[20px] pl-[26px]'}
            onClick={() => {
              router.push('/documents')
              setMenuOpen(!menuOpen)
            }}>
            All Documents
          </div>
          <Link href='/api/auth/logout'>
            <div className={'hover:bg-white/[.3] cursor-pointer p-2 px-[20px] pl-[26px]'}>
              Sign Out
            </div>
          </Link>
        </div>
      </div>

      <div className={`${fadeOut && !hoveringOverMenu && !menuOpen ? 'opacity-0' : 'opacity-100'} transition-opacity duration-700 flex flex-row-reverse z-50 fixed right-[20px] top-[20px]`}>
        <div onClick={() => setMenuOpen(!menuOpen)} className={`hamburger hamburger--spin ${ menuOpen ? 'is-active' : ''}`}>
        <span className="hamburger-box">
          <span className="hamburger-inner"></span>
        </span>
        </div>
      </div>
    </>
  )
}

export default HeaderComponent