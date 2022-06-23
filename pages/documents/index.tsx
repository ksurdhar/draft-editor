import { InferGetServerSidePropsType } from "next"
import Link from "next/link"

// question for discord, how do you share the results of a single 
// http call between components / page that are using SSR?

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
  const documentItems = documents.map((doc: DocumentData) => {
    console.log('DOCUMENT', doc)
    const path = doc.id
    return (
      <div key={path}>
        <Link href={`/documents/${path}`}>
          <a>{doc.title}</a>
        </Link>
      </div>
    )
  })
  
  return (
    <>
      <h1>This is the Documents page</h1>
      { documentItems }
      <h2>
        <Link href="/">
          <a>Back to home</a>
        </Link>
      </h2>
    </>
  )
}

export default DocumentsPage