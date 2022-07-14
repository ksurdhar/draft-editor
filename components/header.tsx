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


  // 52% opacity on whetstone

  return (
    <header className="flex flex-row p-5 max-h-16 justify-between bg-transparent fixed w-[100%] top-0">
      <h1 className='lowercase'><Link href={'/'}>Whetstone</Link></h1>
      <div className={'z-10'}>
        <Menu>
          <div className='flex flex-row-reverse'>
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
          >
          <Menu.Items className={'border-1 border-white border-solid p-2 text-[18px] text-white mr-[24px] gradient-color'}>
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
                }} className={'hover:bg-white/[.3] cursor-pointer p-2'}>
                  Create Document
                </div>
                )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <div onClick={() => {
                  router.push('/documents')
                  setMenuOpen(!menuOpen)
                }} className={'hover:bg-white/[.3] cursor-pointer p-2'}>
                  All Documents
                </div>
                )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <div className={'hover:bg-white/[.3] cursor-pointer p-2'}>
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