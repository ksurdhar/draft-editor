import { useUser } from "@auth0/nextjs-auth0"
import { CloudIcon } from "@heroicons/react/solid"
import { GetServerSideProps, InferGetServerSidePropsType } from "next"
import Head from "next/head"
import Router from "next/router"
import { Dispatch, SetStateAction, useEffect, useState } from "react"
import { BaseSelection, createEditor, Descendant, Text, Transforms, Editor as SlateEditor } from "slate"
import { withHistory } from "slate-history"
import { withReact } from "slate-react"
import useSWR from "swr"
import CommentEditor from "../../components/comment-editor"
import Editor from "../../components/editor"
import Layout from "../../components/layout"
import { Loader } from "../../components/loader"
import { useSpinner } from "../../lib/hooks"
import { AnimationState, DocumentData, WhetstoneEditor } from "../../types/globals"

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
      // console.log('document not cached, applying DB doc')
      setHybridDoc(databaseDoc)
    } else {
      // console.log('document cached, using session storage doc')
      setHybridDoc(cachedDoc as DocumentData)
    }
  }, [databaseDoc, setHybridDoc])
}

const setCommentToLeaf = (editor: WhetstoneEditor, commentText: string, location: BaseSelection) => {
  if (location !== null) {
    const [node] = SlateEditor.nodes(editor, {
      at: location, universal: true, mode: "lowest"
    }) 

    Transforms.setNodes(
      editor,
      { comment: commentText },
      { match: n => n === node[0], split: true }
    )
  }
}

export default function DocumentPage({ id }: InferGetServerSidePropsType<typeof getServerSideProps>) {  
  const [ editor ] = useState(() => withReact(withHistory(createEditor())))
  
  const { data: databaseDoc, mutate } = useSWR<DocumentData>(`/api/documents/${id}`, fetcher) 
  const [ hybridDoc, setHybridDoc ] = useState<DocumentData | null>()
  useSyncHybridDoc(id, databaseDoc, setHybridDoc)
  const showSpinner = useSpinner(!hybridDoc)
  
  const { user, isLoading } = useUser()
  const [ initAnimate, setInitAnimate ] = useState(false)
  const [ recentlySaved, setRecentlySaved ] = useState(false)

  const [ commentActive, setCommentActive ] = useState<AnimationState>('Inactive')
  const [ commentLocation, setCommentLocation ] = useState<BaseSelection>(null)
  const [ commentText, setCommentText ] = useState<Descendant[]>([])

  useEffect(() => {
    setTimeout(() => setRecentlySaved(false), 2010)
  }, [recentlySaved])

  useEffect(() => {
    if (commentActive === 'Active') {
      setTimeout(() => setCommentActive('Complete'), 500)
    }
  }, [commentActive, setCommentActive])

  useEffect(() => {
    if (!isLoading && !user) {
      Router.push('/')
    }
    setTimeout(() => {
      setInitAnimate(true)
    }, 250)
  }, [isLoading, setInitAnimate])

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
          <div className={`duration-500 transition-flex ${commentActive !== 'Inactive' ? 'flex-[0]' : 'flex-1'}`}/>
          <div className={`flex ease-in ease-out ${showSpinner ? 'justify-center flex-col mt-[-36px]' : ''}
            h-[calc(100vh_-_64px)] relative max-w-[740px] min-w-[calc(100vw_-_40px)] md:min-w-[0px] pb-10`}>
            { showSpinner && <Loader/> }
            { hybridDoc && 
              <Editor id={id} text={JSON.parse(hybridDoc.content)}
                editor={editor}
                commentActive={commentActive !== 'Inactive'}
                openComment={(state, text) => {
                  setCommentActive(state)
                  setCommentLocation(editor.selection)
                  setCommentText(text)
                }}
                title={hybridDoc.title} 
                onUpdate={() => {
                  setRecentlySaved(true)
                  mutate()
                }}
              />
            }
          </div>
          <div className={`duration-500 transition-flex ${commentActive !== 'Inactive' ? 'flex-[0]' : 'flex-1'}`}/>
         { commentActive === 'Complete' && 
          <CommentEditor onSubmit={(text) => {
            setCommentToLeaf(editor, text, commentLocation)
            setCommentActive('Inactive')
            setCommentText([])
          }}
          onCancel={() => {
            setCommentActive('Inactive')
            setCommentText([])
          }}
          comment={commentText}
          />
         }
        </div> 
      </Layout> 
    </>
  )
}