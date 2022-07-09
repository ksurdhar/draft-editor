import { XIcon } from "@heroicons/react/solid"
import Link from "next/link"
import Layout from "../../components/layout"
import API from "../../lib/utils"
import { withPageAuthRequired } from "@auth0/nextjs-auth0"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const DocumentsPage = withPageAuthRequired(({ user }) => {
  const { data: docs, mutate } = useSWR<DocumentData[]>('/api/documents', fetcher) 

  if (!docs) return (
    <Layout>
      <h1>Loading documents...</h1>
    </Layout>
  )
  

  const documentItems = docs.map(({ id, title }) => {
    return (
      <div key={id} className='flex'>
        <Link href={`/documents/${id}`}>
          <a>{title}</a>
        </Link>
        <XIcon 
          onClick={async (e) => {
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
      <h1>Documents</h1>
      { documentItems }
      <h2>
        <Link href="/">
          <a>Back to home</a>
        </Link>
      </h2>
    </Layout>
  )
})

export default DocumentsPage