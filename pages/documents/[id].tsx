import { useUser } from "@auth0/nextjs-auth0"
import { CloudIcon } from "@heroicons/react/solid"
import { GetServerSideProps, InferGetServerSidePropsType } from "next"
import Head from "next/head"
import Router from "next/router"
import { useEffect, useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import Editor from "../../components/editor"
import Layout from "../../components/layout"

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  return {
    props: {
      id: params && params.id
    },
  }
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function DocumentPage({ id }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { user, isLoading } = useUser()
  const [ editorColor, setEditorColor ] = useState(false)
  const [ recentlySaved, setRecentlySaved ] = useState(false)
  const { mutate } = useSWRConfig()

  useEffect(() => {
    setTimeout(() => setRecentlySaved(false), 2010)
  }, [recentlySaved])

  useEffect(() => {
    if (!isLoading && !user) {
      Router.push('/')
    }
    setTimeout(() => {
      setEditorColor(true)
    }, 250)
  }, [isLoading])

  const { data: document } = useSWR<DocumentData>(`/api/documents/${id}`, fetcher) 

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
      { recentlySaved && (
        <div className={`fixed top-0 right-[30px] z-[40] p-[20px]`}>
          <CloudIcon className=' animate-bounce fill-black/[.10]  md:fill-black/[.15] h-[20px] w-[20px] md:h-[24px] md:w-[24px] self-center'/>
        </div>
      )}
      <div className="flex justify-center pb-10 p-[20px] mt-[64px] text-black/[.79] font-editor2">
        <div className="flex flex-col h-[calc(100vh_-_64px)] pb-10 min-w-[calc(100vw_-_40px)] md:min-w-[0px] max-w-[740px] md:w-[740px]">
          { document && <Editor id={id} text={JSON.parse(document.content)} title={document.title} 
            onUpdate={() => {
              setRecentlySaved(true)
              mutate(`/api/documents/${id}`)
            }} 
          /> }
          { !document && 'rendering' }
        </div>
      </div>
    </Layout> 
    </>
  
  )
}