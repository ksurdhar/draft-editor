import { useUser } from "@auth0/nextjs-auth0"
import { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
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
    <>
      <Head>
        <title>Draft Editor</title>
        <link href="https://fonts.googleapis.com/css2?family=Ibarra+Real+Nova&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=EB+Garamond&display=swap" rel="stylesheet"/>
      </Head>
      <Layout>
        <div className="flex justify-center pb-10 p-[20px] text-black/[.79] font-editor2">
            <div className="flex flex-col h-[calc(100vh_-_64px)] pb-10 max-w-[740px]">
              <h1 className="mb-2 text-3xl md:text-4xl uppercase">{document.title}</h1>
              <Editor id={id} text={JSON.parse(document.content)} />
            </div>
        </div>
    </Layout> 
    </>
  
  )
}