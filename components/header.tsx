import { MenuIcon, PlusIcon } from '@heroicons/react/solid'
import { useRouter } from 'next/router'
import API from '../lib/utils'

const HeaderComponent = () => {
  const router = useRouter()

  return (
    <header className="flex flex-row p-5 justify-between">
      <h1>Draft Writer</h1>
      <ul className="flex flex-row">
        <li className='mr-2.5'>
          <PlusIcon 
            onClick={async (e) => {
              try {
                const res = await API.post(`documents`, { title: 'New Document' })
                console.log('res', res)
                const documentId = res.data.id
                router.push(`/documents/${documentId}`)
              } catch (e) {
                console.log(e)
              }

            }}
            className="hover:text-indigo-500 cursor-pointer h-5 w-5"/>
        </li>
        <li>
          <MenuIcon 
            onClick={() => {
              // replace with open menu
              router.push('/documents')
            }}
            className="cursor-pointer hover:text-indigo-500 h-5 w-5"/>
        </li>
      </ul>
    </header>
  )
}

export default HeaderComponent