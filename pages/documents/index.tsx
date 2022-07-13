import { DotsHorizontalIcon } from "@heroicons/react/solid"
import Layout from "../../components/layout"
import API from "../../lib/utils"
import { withPageAuthRequired } from "@auth0/nextjs-auth0"
import useSWR from "swr"
import { format } from "date-fns"
import { useRouter } from "next/router"
import Head from "next/head"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const DocumentsPage = withPageAuthRequired(({ user }) => {
  const { data: docs, mutate } = useSWR<DocumentData[]>('/api/documents', fetcher) 
  const router =  useRouter()

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

      <div className={`flex justify-between h-[40px] px-[10px] ${idx !== docs.length - 1 ? 'border-b' : 'border-transparent'} border-solid border-black/[.35]
        hover:cursor-pointer hover:bg-white/[.30] uppercase text-[14px] font-semibold font-index
      `}
      onClick={() => {
        router.push(`/documents/${id}`)
      }}
      key={id}
      >
        <div className="grow self-center whitespace-nowrap overflow-hidden text-ellipsis">
          {title}
        </div>

        <div className="min-w-[7rem] w-28 md:w-44 md:min-w-[11rem] self-center text-black/[.65]">
          {format(new Date(lastUpdated), 'PP')}
        </div>

      <div className="flex items-center">
        <div className='rounded-full h-[28px] w-[28px] flex flex-col justify-center hover:bg-black/[.10]'>
          <DotsHorizontalIcon 
            onClick={async (e) => {
              e.stopPropagation()
              try {
                await API.delete(`/api/documents/${id}`)
                mutate()
              } catch(e) {
                console.log(e)
              }
            }}
            className='h-[16px] w-[16px] self-center'/>
        </div>
      </div>
        
      </div>
    )
  })

  // some kind of empty state when you have no documents
  // document name, last modified
  return (
    <>
    <Head>
      <title>Whetstone - Documents</title>
      <link href="https://fonts.googleapis.com/css2?family=Mukta&display=swap" rel="stylesheet" />
    </Head>
    <Layout>
      <div className='gradient absolute top-0 left-0 h-screen w-screen z-[-1]'/>
      <div className="flex justify-center h-[calc(100vh_-_64px)] pb-10">
        <div className={'w-11/12 sm:w-9/12 max-w-[740px]'}> 
          <div className='flex flex-col h-[100%] justify-center mt-[-64px]'>
            { documentItems }
          </div>
        </div>
      </div>
    </Layout>
    </>
  )
})

export default DocumentsPage