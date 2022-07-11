import { XIcon } from "@heroicons/react/solid"
import Link from "next/link"
import Layout from "../../components/layout"
import API from "../../lib/utils"
import { withPageAuthRequired } from "@auth0/nextjs-auth0"
import useSWR from "swr"
import { formatDistance } from "date-fns"
import { useRouter } from "next/router"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const DocumentsPage = withPageAuthRequired(({ user }) => {
  const { data: docs, mutate } = useSWR<DocumentData[]>('/api/documents', fetcher) 
  const router =  useRouter()

  if (!docs) return (
    <Layout>
      <h1>Loading documents...</h1>
    </Layout>
  )

  const documentItems = docs.map(({ id, title, lastUpdated }, idx) => {
    return (

      <div className={`flex justify-between h-12 ${idx !== docs.length - 1 ? 'border-b' : ''} border-solid border-slate-200
        hover:cursor-pointer hover:bg-sky-100
      `}
      onClick={() => {
        router.push(`/documents/${id}`)
      }}
      >
        <div className="grow self-center">
          {title}
        </div>

        <div className="w-44 self-center">{formatDistance(new Date(lastUpdated), new Date(), { addSuffix: true })}</div>

        <XIcon 
          onClick={async (e) => {
            e.stopPropagation()
            try {
              await API.delete(`/api/documents/${id}`)
              mutate()
            } catch(e) {
              console.log(e)
            }
          }}
          className='ml-2.5 h-5 w-5 self-center cursor-pointer hover:text-indigo-500'/>
      </div>
    )
  })

  // some kind of empty state when you have no documents
  // document name, last modified
  return (
    <Layout>
      <div className="flex justify-center h-[calc(100vh_-_64px)] pb-10">
        <div className={'w-9/12'}> 
          { documentItems }
        </div>
      </div>
    </Layout>
  )
})

export default DocumentsPage