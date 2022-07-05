import { XIcon } from "@heroicons/react/solid"
import { InferGetServerSidePropsType } from "next"
import Link from "next/link"
import { useState } from "react"
import Layout from "../../components/layout"
import API from "../../lib/utils"
import { getDocuments } from "../../lib/apiUtils"

export const getServerSideProps = async () => {
  const documents = await getDocuments() 

  return {
    props: {
      documents: documents as DocumentData[]
    },
  }
}

const DocumentsPage = ({ documents }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const [ docs, setDocs ] = useState(documents)

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