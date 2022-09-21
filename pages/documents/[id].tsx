import { useUser } from "@auth0/nextjs-auth0"
import { CloudIcon } from "@heroicons/react/solid"
import { GetServerSideProps, InferGetServerSidePropsType } from "next"
import Head from "next/head"
import Router from "next/router"
import { Dispatch, SetStateAction, useEffect, useState } from "react"
import useSWR from "swr"
import CommentEditor from "../../components/comment-editor"
import Editor from "../../components/editor"
import Layout from "../../components/layout"
import { Loader } from "../../components/loader"
import { useSpinner } from "../../lib/hooks"

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  return {
    props: {
      id: params && params.id
    },
  }
}

const backdropStyles = `
  fixed top-0 left-0 h-screen w-screen z-[-1]
  transition-opacity ease-in-out duration-[3000ms]
`

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const useSyncHybridDoc = (id: string, databaseDoc: DocumentData | undefined, setHybridDoc: Dispatch<SetStateAction<DocumentData | null | undefined>>) => {
  useEffect(() => {
    let cachedDoc: DocumentData | {} = {}
    if (typeof window !== 'undefined') {
      cachedDoc = JSON.parse(sessionStorage.getItem(id) || '{}')
    }
    const documentNotCached = Object.keys(cachedDoc).length === 0

    if (documentNotCached) {
      console.log('document not cached, applying DB doc')
      setHybridDoc(databaseDoc)
    } else {
      console.log('document cached, using session storage doc')
      setHybridDoc(cachedDoc as DocumentData)
    }
  }, [databaseDoc, setHybridDoc])
}

export default function DocumentPage({ id }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { data: databaseDoc, mutate } = useSWR<DocumentData>(`/api/documents/${id}`, fetcher) 
  const [ hybridDoc, setHybridDoc ] = useState<DocumentData | null>()
  useSyncHybridDoc(id, databaseDoc, setHybridDoc)
  
  const { user, isLoading } = useUser()
  const [ initAnimate, setInitAnimate ] = useState(false)
  const [ recentlySaved, setRecentlySaved ] = useState(false)
  const [ commentActive, setCommentActive ] = useState(false)
  const showSpinner = useSpinner(!hybridDoc)

  useEffect(() => {
    setTimeout(() => setRecentlySaved(false), 2010)
  }, [recentlySaved])

  useEffect(() => {
    if (!isLoading && !user) {
      Router.push('/')
    }
    setTimeout(() => {
      setInitAnimate(true)
    }, 250)
  }, [isLoading])

  return (
    <>
      <Head>
        <title>{`whetstone - ${hybridDoc?.title}`}</title>
      </Head>
      <Layout>
        <div className={`gradient ${initAnimate ? 'opacity-0' : 'opacity-100' } ${backdropStyles}`}/>
        <div className={`gradient-editor ${initAnimate ? 'opacity-100' : 'opacity-0' } ${backdropStyles}`}/>
        { recentlySaved && (
          <div className={`fixed top-0 right-[30px] z-[40] p-[20px]`}>
            <CloudIcon className='animate-bounce fill-black/[.10] md:fill-black/[.15] h-[20px] w-[20px] md:h-[24px] md:w-[24px] self-center'/>
          </div>
        )}
        <div className={`flex pb-10 p-[20px] mt-[64px] text-black/[.79] font-editor2`}>
          <div className={`duration-1000 transition-flex ${commentActive ? 'flex-[0]' : 'flex-1'}`}/>
          <div className={`flex ease-in ease-out ${showSpinner ? 'justify-center flex-col mt-[-36px]' : ''}
            h-[calc(100vh_-_64px)] relative max-w-[740px] min-w-[calc(100vw_-_40px)] md:min-w-[0px] pb-10`}>
            { showSpinner && <Loader/> }
            { hybridDoc && 
              <Editor id={id} text={JSON.parse(hybridDoc.content)}
                commentActive={commentActive}
                setCommentActive={setCommentActive}
                title={hybridDoc.title} 
                onUpdate={() => {
                  setRecentlySaved(true)
                  mutate()
                }}
              />
            }
          </div>
          <div className={`duration-1000 transition-flex ${commentActive ? 'flex-[0]' : 'flex-1'}`}/>
         { commentActive && <CommentEditor commentActive={commentActive}/>}
        </div>
      </Layout> 
    </>
  )
}
// ${commentActive? 'right-[calc(20vw_-_28px)]' : 'right-0'}
// ${commentActive ? 'max-w-[53%]' : 'max-w-[740px]' }