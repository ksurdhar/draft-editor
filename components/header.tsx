import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '@auth0/nextjs-auth0'
import { useState } from 'react'
import { Menu, Transition } from '@headlessui/react'

import API from '../lib/utils'


{/* <span className='pr-4'>Hi, Kiran</span> */}
{/* {user && <span>Hi, ${user.name}</span>} */}

const HeaderComponent = () => {
  const router = useRouter()
  const { user } = useUser()
  const [ menuOpen, setMenuOpen ] = useState(false)

  return (
    <header className="flex flex-row p-5 max-h-16 justify-between bg-transparent">
      <h1 className='lowercase'><Link href={'/'}>Whetstone</Link></h1>
      <div>
        <Menu>
          <div className='flex flex-row-reverse z-10 absolute right-[20px]'>
            <Menu.Button onClick={() => setMenuOpen(!menuOpen)} className={`hamburger hamburger--spin ${ menuOpen ? 'is-active' : ''}`}>
              <span className="hamburger-box">
                <span className="hamburger-inner"></span>
              </span>
            </Menu.Button>
          </div>
          <Transition
            enter="transition duration-500 ease-in"
            enterFrom="transform opacity-0"
            enterTo="transform opacity-100"
            leave="transition duration-500 ease-out"
            leaveFrom="transform opacity-100"
            leaveTo="transform opacity-0"
            className={'absolute top-0 right-0'}
          >
          <Menu.Items static className={'h-[100vh] w-[30vw] min-w-[300px] menu-gradient p-[10px] pt-[48px] text-[20px] text-white'}>
            <Menu.Item>
              {({ active }) => (
                <div onClick={async () => {
                  setMenuOpen(!menuOpen)
                  try {
                    const res = await API.post(`/api/documents`, { title: 'Document with my Id', userId: user?.sub })
                    const documentId = res.data.id
                    router.push(`/documents/${documentId}`)
                  } catch (e) {
                    console.log(e)
                  }
                }} className={'hover:bg-white/[.3] cursor-pointer p-2 px-[10px]'}>
                  Create Document
                </div>
                )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <div onClick={() => {
                  router.push('/documents')
                  setMenuOpen(!menuOpen)
                }} className={'hover:bg-white/[.3] cursor-pointer p-2 px-[10px]'}>
                  All Documents
                </div>
                )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <div className={'hover:bg-white/[.3] cursor-pointer p-2 px-[10px]'}>
                  <Link href='/api/auth/logout'>
                    <a>Sign Out</a>
                  </Link>
                </div>
                )}
            </Menu.Item>
          </Menu.Items>
          </Transition>
        </Menu>
      </div>
        
    </header>
  )
}

export default HeaderComponent