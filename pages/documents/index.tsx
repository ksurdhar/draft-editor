import { DotsHorizontalIcon } from "@heroicons/react/solid"
import Layout from "../../components/layout"
import API from "../../lib/utils"
import { withPageAuthRequired } from "@auth0/nextjs-auth0"
import useSWR from "swr"
import { format } from "date-fns"
import { useRouter } from "next/router"
import Head from "next/head"
import Link from "next/link"
import { useState } from "react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const DocumentsPage = withPageAuthRequired(({ user }) => {
  const { data: docs, mutate } = useSWR<DocumentData[]>('/api/documents', fetcher) 
  const [ selectedDoc , setSelectedDoc ] = useState<string | null>(null)
  const router =  useRouter()

  // good gravy, extract this code and dry it up dude
  if (!docs) return (
    <Layout>
      <div className='gradient absolute top-0 left-0 h-screen w-screen z-[-1]'/>
      <div className="flex justify-center h-[calc(100vh_-_64px)] pb-10">
        <div className={'w-11/12 sm:w-9/12 max-w-[740px]'}> 
          <div className='flex flex-col h-[100%] justify-center mt-[-64px]'>
           <h1>Loading documents...</h1>
          </div>
        </div>
      </div>
    </Layout>
  )

  const documentItems = docs.map(({ id, title, lastUpdated }, idx) => {
    return (
      <div className={`
          transition duration-[250ms]
          ${id === selectedDoc ? 'bg-white/[.30] border-black/[.14]' : ''}
          ${ selectedDoc && id !== selectedDoc ? 'opacity-40 pointer-events-none' : ''} 
          flex justify-between min-h-[40px] px-[10px]
          hover:cursor-pointer hover:bg-white/[.30] uppercase text-[14px] font-semibold
          ${idx !== docs.length - 1 ? 'border-b' : 'border-transparent'} border-solid border-black/[.35]`
        }
        onClick={() => {
          if (!selectedDoc) {
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
        <div className='rounded-full h-[28px] w-[28px] flex flex-col justify-center hover:bg-black/[.10]'>
          <DotsHorizontalIcon 
            onClick={async (e) => {
              e.stopPropagation()
              if (selectedDoc === id) {
                setSelectedDoc(null)
              } else {
                setSelectedDoc(id)
              }
              
              // try {
              //   await API.delete(`/api/documents/${id}`)
              //   mutate()
              // } catch(e) {
              //   console.log(e)
              // }
            }}
            className='h-[16px] w-[16px] self-center'/>
        </div>
      </div>
        
      </div>
    )
  })

  return (
    <>
    <Head>
      <title>Whetstone - Documents</title>
      <link href="https://fonts.googleapis.com/css2?family=Mukta&display=swap" rel="stylesheet" />
    </Head>
    <Layout>
      <div className='gradient absolute top-0 left-0 h-screen w-screen z-[-1]'/>
      <div className="relative top-[64px] flex justify-center h-[calc(100vh_-_64px)] pb-10"
        onClick={() => {
          if (selectedDoc) {
            setSelectedDoc(null)
          }          
        }}
      >
        <div className={'flex flex-col justify-center w-11/12 sm:w-9/12 max-w-[740px]'}> 
          <div className='overflow-y-scroll max-h-[280px]'>
            { documentItems }
          </div>
          <div className={`${selectedDoc ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-[250ms] flex justify-evenly mt-[48px]`}>
            <button className="file-button hover:bg-white/[.15]" role="button">rename</button>
            <button className="file-button file-button-red hover:bg-white/[.15]" role="button">delete</button>
          </div>
        </div>
      </div>
    </Layout>
    </>
  )
})

export default DocumentsPage