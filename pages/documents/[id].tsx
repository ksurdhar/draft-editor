// import { GetStaticProps } from "next"
import Link from "next/link"
import Editor from "../../components/editor"

type DocumentPageProps = {
  document: DocumentData
}

export async function getStaticPaths() {
  const res = await fetch('http://localhost:1000/documents')
  const documents: DocumentData[] = await res.json()

  const paths =  documents.map((document) => {
    return {
      params: {
        id: document.id,
      },
    }
  })

  return { 
    paths: paths, 
    fallback: false 
  }
}

type Params = {
  params: {
    id: string
  }
}

export const getStaticProps = async ({ params }: Params) => {
  const res = await fetch(`http://localhost:1000/documents/${params.id}`)
  const document: DocumentData = await res.json()
  return {
    props: {
      document,
    },
  }
}

export default function DocumentPage({ document }: DocumentPageProps) {
  return (
   <div>
    <h1 className="text-3xl font-bold underline">You are editing: {document.title}</h1>
    <Link href={'/documents'}>
      <a>All Documents</a>
    </Link>
    <Editor documentText={document.content} documentId={document.id} />
   </div> 
  )
}