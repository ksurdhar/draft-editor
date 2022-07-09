import Link from 'next/link'
import { useRouter } from 'next/router'
import { useUser } from '@auth0/nextjs-auth0'
import { useState } from 'react'
import { Menu, Transition } from '@headlessui/react'

import API from '../lib/utils'


// className="hover:text-indigo-500 cursor-pointer h-5 w-5"/>

const HeaderComponent = () => {
  const router = useRouter()
  const { user } = useUser()
  const [ menuOpen, setMenuOpen ] = useState(false)

  return (
    <header className="flex flex-row p-5 max-h-16 justify-between">
      <h1><Link href={'/'}>Draft Writer</Link></h1>
      <div>
        <Menu>
          <div className='flex flex-row-reverse'>
            <Menu.Button onClick={() => setMenuOpen(!menuOpen)} className={`hamburger hamburger--spin ${ menuOpen ? 'is-active' : ''}`}>
              <span className="hamburger-box">
                <span className="hamburger-inner"></span>
              </span>
            </Menu.Button>
            {/* <span className='pr-4'>Hi, Kiran</span> */}
            {/* {user && <span>Hi, ${user.name}</span>} */}
          </div>
          <Transition
            enter="transition duration-500 ease-in"
            enterFrom="transform opacity-0"
            enterTo="transform opacity-100"
            leave="transition duration-500 ease-out"
            leaveFrom="transform opacity-100"
            leaveTo="transform opacity-0"
          >
          <Menu.Items>
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
                }} className={`${active && 'bg-blue-500'} my-3`}>
                  Create Document
                </div>
                )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <div onClick={() => {
                  router.push('/documents')
                  setMenuOpen(!menuOpen)
                }} className={`${active && 'bg-blue-500'} my-3`}>
                  All Documents
                </div>
                )}
            </Menu.Item>
            <Menu.Item>
              {({ active }) => (
                <div className={`${active && 'bg-blue-500'} my-3`}>
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