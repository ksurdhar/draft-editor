import Link from "next/link"
import Editor from "../../components/editor"
import Layout from "../../components/layout"

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
   <Layout>
    <h1 className="mb-2 text-3xl font-bold underline">{document.title}</h1>
    <Editor documentText={document.content} documentId={document.id} key={document.id}/>
   </Layout> 
  )
}