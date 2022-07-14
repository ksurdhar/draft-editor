import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '@auth0/nextjs-auth0'
import { useState } from 'react'

import API from '../lib/utils'


const HeaderComponent = () => {
  const router = useRouter()
  const { user } = useUser()
  const [ menuOpen, setMenuOpen ] = useState(false)

  return (
    <header className="flex flex-row p-5 max-h-16 justify-between bg-transparent">
      <h1 className='lowercase'><Link href={'/'}>Whetstone</Link></h1>
      <div>
          <div className='flex flex-row-reverse z-20 absolute right-[20px]'>
            <div onClick={() => setMenuOpen(!menuOpen)} className={`hamburger hamburger--spin ${ menuOpen ? 'is-active' : ''}`}>
              <span className="hamburger-box">
                <span className="hamburger-inner"></span>
              </span>
            </div>
          </div>

          <div className={`${router.pathname === '/documents' ? 'bg-menu' : 'bg-menu-dark'} transition-[right] ease-in-out duration-500 absolute top-0 ${menuOpen ? 'right-0' : 'right-[-500px]'} h-[100vh] min-w-[300px] 
            p-[10px] pt-[48px] text-[20px] text-white z-10`}>
            <div className={'hover:bg-white/[.3] cursor-pointer p-2 px-[20px] pl-[26px]'}
              onClick={async () => {
                setMenuOpen(!menuOpen)
                try {
                  const res = await API.post(`/api/documents`, { title: 'Document with my Id', userId: user?.sub })
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
            <div className={'hover:bg-white/[.3] cursor-pointer p-2 px-[20px] pl-[26px]'}>
              <Link href='/api/auth/logout'>
                <a>Sign Out</a>
              </Link>
            </div>
          </div>

        </div>
    </header>
  )
}

export default HeaderComponent