import { DotsHorizontalIcon } from "@heroicons/react/solid"
import Layout from "../../components/layout"
import API from "../../lib/utils"
import { withPageAuthRequired } from "@auth0/nextjs-auth0"
import useSWR, { useSWRConfig } from "swr"
import { format } from "date-fns"
import { useRouter } from "next/router"
import Head from "next/head"
import Link from "next/link"
import { useState } from "react"
import { Loader } from "../../components/loader"
import { useSpinner } from "../../lib/hooks"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const DocumentsPage = withPageAuthRequired(() => {
  const { data: docs, mutate } = useSWR<DocumentData[]>('/api/documents', fetcher, { })
  const safeDocs = docs ? docs : []
  const { cache } = useSWRConfig()
  const [ selectedDocId , setSelectedDoc ] = useState<string | null>(null)
  const [ renameActive , setRenameActive ] = useState(false)
  const [ newName, setNewName ] = useState('')
  const router =  useRouter()
  const allowSpinner = useSpinner()

  const documentItems = safeDocs.map(({ id, title, lastUpdated }, idx) => {
    return (
      <div className={`
          animate-fadein
          transition duration-[250ms]
          ${id === selectedDocId ? 'bg-white/[.30] border-black/[.14]' : ''}
          ${ selectedDocId && id !== selectedDocId ? 'opacity-40 pointer-events-none' : ''} 
          flex justify-between min-h-[40px] px-[10px]
          hover:cursor-pointer hover:bg-white/[.30] 
          uppercase text-[14px] font-semibold
          ${idx !== safeDocs.length - 1 ? 'border-b' : 'border-transparent'} border-solid border-black/[.35]`
        }
        onClick={() => {
          if (!selectedDocId) {
            router.push(`/documents/${id}`)
          }
        }}
        key={id}
      >
        <div className="grow self-center whitespace-nowrap overflow-hidden text-ellipsis">
          <Link href={`/documents/${id}`}>{title}</Link>
        </div>

        <div className="min-w-[7rem] w-28 md:w-44 md:min-w-[11rem] self-center text-black/[.65]">
          {format(new Date(lastUpdated), 'PP')}
        </div>

      <div className="flex items-center">
        <div className='rounded-full h-[28px] w-[28px] flex flex-col justify-center hover:bg-black/[.10]'
          onClick={async (e) => {
            e.stopPropagation()
            if (selectedDocId === id) {
              setSelectedDoc(null)
            } else {
              setSelectedDoc(id)
            }
          }}
        >
          <DotsHorizontalIcon className='h-[16px] w-[16px] self-center'/>
        </div>
      </div>
        
      </div>
    )
  })

  const emptyMessage = (
    <div className={'uppercase text-[14px] font-semibold text-center text-black/[.5]'}>
      Empty / Go create something of worth 
    </div>
  )

  return (
    <>
    <Head>
      <title>whetstone</title>
    </Head>
    <Layout>
      <div className='gradient absolute top-0 left-0 h-screen w-screen z-[-1]'/>
      <div className="relative top-[64px] flex justify-center h-[calc(100vh_-_64px)] pb-10"
        onClick={() => {
          if (selectedDocId || renameActive) {
            setSelectedDoc(null)
            setTimeout(() => setRenameActive(false), 251) // bit of a hack to prevent animations
          }          
        }}
      >
        <div className={'flex flex-col justify-center w-11/12 sm:w-9/12 max-w-[740px]'}> 
          <div className='overflow-y-scroll max-h-[280px]'>
            { !docs && allowSpinner && 
              <div className='flex flex-row justify-center'>
                <Loader/>
              </div>
            }
            { documentItems }
            { docs && documentItems.length < 1 && emptyMessage }
          </div>

          {/* the selected item's 'menu' area  */}
          <div className={`${selectedDocId ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-[250ms] h-[40px] flex justify-evenly mt-[48px]`}>
            {
              !renameActive && 
              <>
                <button onClick={(e) => {
                  e.stopPropagation()
                  setRenameActive(true)
                }} className="file-button hover:bg-white/[.15]" role="button">rename</button>
                <button onClick={async (e) => {
                  e.stopPropagation()
                  try {
                    await API.delete(`/api/documents/${selectedDocId}`)
                    mutate()
                  } catch(e) {
                    console.log(e)
                  }
                  setSelectedDoc(null)
                }}
                  className="file-button file-button-red hover:bg-white/[.15]" role="button">delete</button>
              </>
            }
             {
              renameActive && 
              <form className={'w-[70%]'} onSubmit={async (e) => {
                e.preventDefault()
                await API.patch(`/api/documents/${selectedDocId}`, {
                  title: newName,
                  lastUpdated: Date.now()
                }) 
                setRenameActive(false)
                setSelectedDoc(null)
                mutate()
                cache.delete(`/api/documents/${selectedDocId}`)
              }}>
                <input onChange={(e) => setNewName(e.currentTarget.value)} onClick={(e) => e.stopPropagation()} type='text' spellCheck='false' autoFocus placeholder={`New Title`} className={
                  `w-[100%] bg-transparent border-x-0 border-t-0 border-b-[1px] focus:border-black/[.2] focus:ring-transparent ring-transparent 
                  uppercase text-[18px] font-editor2 text-black/[.70] text-center placeholder:text-black/[.25]`} 
                />
             </form>
            }
          </div>
        </div>
      </div>
    </Layout>
    </>
  )
})

export default DocumentsPage