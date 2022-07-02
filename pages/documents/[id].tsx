import { Descendant } from "slate"
import Editor from "../../components/editor"
import Layout from "../../components/layout"

type DocumentPageProps = {
  document: DocumentData
}

// this is necessary / idiomatic to help prerender these pages
export async function getStaticPaths() {
  const res = await fetch('http://localhost:1000/documents')
  const documents: DocumentData[] = await res.json()

  const paths = documents.map((document) => {
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

// I should replace this with client side data fetching since things get updated so frequently
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
  let slateFriendlyText: Descendant[] = [
    {
      type: 'default',
      children: [{ text: '', highlight: 'none' }],
    },
  ]

  // replace with loading state for document
  if (document.content.length > 0) {
    slateFriendlyText = JSON.parse(document.content) 
  }

  return (
   <Layout>
    <h1 className="mb-2 text-3xl font-bold underline">{document.title}</h1>
    <Editor documentText={slateFriendlyText} documentId={document.id} key={document.id}/>
   </Layout> 
  )
}