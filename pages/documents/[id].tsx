import { useUser } from "@auth0/nextjs-auth0"
import { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import Router from "next/router"
import { useEffect, useState } from "react"
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
  const [ editorColor, setEditorColor ] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      Router.push('/')
    }
    setTimeout(() => {
      setEditorColor(true)
    }, 250)
  }, [isLoading])

  const { data: document } = useSWR<DocumentData>(`/api/documents/${id}`, fetcher,  { refreshInterval: 1000 }) 

  return (
    <>
      <Head>
        <title>Draft Editor</title>
        <link href="https://fonts.googleapis.com/css2?family=Mukta&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Ibarra+Real+Nova&display=swap" rel="stylesheet" />
      </Head>
      <Layout>

      <div className={`transition-opacity ease-in-out duration-[3000ms] gradient ${editorColor ? 'opacity-0' : 'opacity-100' }  fixed top-0 left-0 h-screen w-screen z-[-1]`}/>
      <div className={`transition-opacity ease-in-out duration-[3000ms] gradient-editor ${editorColor ? 'opacity-100' : 'opacity-0' }  fixed top-0 left-0 h-screen w-screen z-[-1]`}/>
      <div className="flex justify-center pb-10 p-[20px] mt-[64px] text-black/[.79] font-editor2">
        <div className="flex flex-col h-[calc(100vh_-_64px)] pb-10 min-w-[calc(100vw_-_40px)] md:min-w-[0px] max-w-[740px] md:w-[740px]">
          { document && <Editor id={id} text={JSON.parse(document.content)} title={document.title} /> }
          { !document && 'rendering' }
        </div>
      </div>
    </Layout> 
    </>
  
  )
}