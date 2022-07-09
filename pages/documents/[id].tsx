import { useUser } from "@auth0/nextjs-auth0"
import { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next"
import Router from "next/router"
import { useEffect } from "react"
import useSWR from "swr"
import Editor from "../../components/editor"
import Layout from "../../components/layout"
import { getEverybodysDocuments } from "../../lib/apiUtils"

export const getStaticPaths: GetStaticPaths = async () => {
  const documents = await getEverybodysDocuments()

  const paths = documents.map((document) => ({
    params: {
      id: `${document.id}`,
    },
  }))

  return { 
    paths: paths, 
    fallback: false 
  }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  return {
    props: {
      id: params && params.id
    },
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function DocumentPage({ id }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { user, isLoading } = useUser()

  useEffect(() => {
    if (!isLoading && !user) {
      Router.push('/')
    }
  }, [isLoading])

  const { data: document } = useSWR<DocumentData>(`/api/documents/${id}`, fetcher,  { refreshInterval: 1000 }) 

  if (!document) return (
    <Layout>
      <div>rendering</div>
    </Layout>
  )

  return (
   <Layout>
    <h1 className="mb-2 text-3xl font-bold underline">{document.title}</h1>
    <Editor id={id} text={JSON.parse(document.content)} />
   </Layout> 
  )
}