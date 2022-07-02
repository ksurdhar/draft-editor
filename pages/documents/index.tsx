import { XIcon } from "@heroicons/react/solid"
import { InferGetServerSidePropsType } from "next"
import Link from "next/link"
import { useState } from "react"
import Layout from "../../components/layout"
import API from "../../lib/utils"

export const getServerSideProps = async () => {
  const res = await fetch('http://localhost:1000/documents')
  const documents: DocumentData[] = await res.json()
  return {
    props: {
      documents,
    },
  }
}

const DocumentsPage = ({ documents }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const [ docs, setDocs ] = useState(documents)

  const documentItems = docs.map(({ id, title }: DocumentData) => {
    return (
      <div key={id} className='flex'>
        <Link href={`/documents/${id}`}>
          <a>{title}</a>
        </Link>
        <XIcon 
          onClick={async (e) => {
            try {
              await API.delete(`documents/${id}`)
              const newDocs = docs.filter((doc) => doc.id !== id)
              setDocs(newDocs)
            } catch(e) {
              console.log(e)
            }
          }}
          className='ml-2.5 h-5 w-5 self-center cursor-pointer hover:text-indigo-500'/>
      </div>
    )
  })
  
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
}

export default DocumentsPage