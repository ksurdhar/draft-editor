import { useUser } from "@auth0/nextjs-auth0"
import { CloudIcon } from "@heroicons/react/solid"
import { GetServerSideProps, InferGetServerSidePropsType } from "next"
import Head from "next/head"
import Router from "next/router"
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react"
import { createEditor, Descendant, Text, Transforms, Editor as SlateEditor, Element, Node, NodeEntry, Location } from "slate"
import { withHistory } from "slate-history"
import { withReact } from "slate-react"
import useSWR from "swr"
import { useDebouncedCallback } from "use-debounce"
import CommentEditor from "../../components/comment-editor"
import Editor from "../../components/editor"
import Layout from "../../components/layout"
import { Loader } from "../../components/loader"
import { useSpinner } from "../../lib/hooks"
import API from "../../lib/utils"
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

const cancelComment = (editor: WhetstoneEditor, location: Location) => {
  Transforms.setNodes(
    editor,
    { highlight: undefined }, // also remove commentId here once added
    { match: n => Text.isText(n) && n.highlight === 'pending', at: location }
  )
}

// needs to accept the id of the comment as a param
const commitComment = (editor: WhetstoneEditor, location: Location) => {
  Transforms.setNodes(
    editor,
    { highlight: 'comment' },
    { match: n => Text.isText(n) && n.highlight === 'pending', at: location}
  )
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
  const [ commentText, setCommentText ] = useState<Descendant[]>([])
  const [ pendingCommentRef, setPendingCommentRef ] = useState<NodeEntry<Node> | null>(null)

  const saveDocument = useDebouncedCallback(
    async (data: Partial<DocumentData>) => { 
      const updatedData = {
        ...data,
        lastUpdated: Date.now()
      }

      const cachedDoc = JSON.parse(sessionStorage.getItem(id) || '{}')
      const documentCached = Object.keys(cachedDoc).length > 0
      if (documentCached) {
        sessionStorage.setItem(id, JSON.stringify({...cachedDoc, ...updatedData})) 
      }
      
      await API.patch(`/api/documents/${id}`, updatedData)
      setRecentlySaved(true)
    }, 1000
  )

  const captureCommentRef = (editor: WhetstoneEditor) => {
    Transforms.setNodes(
      editor,
      { highlight: 'pending' },
      { match: n => Text.isText(n), split: true }
    )

    const [match] = SlateEditor.nodes(editor, {
      match: n => Element.isElement(n),
      universal: true,
    })
    setPendingCommentRef(match)
  }

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
                  setCommentText(text)
                  captureCommentRef(editor)
                }}
                title={hybridDoc.title} 
                onUpdate={(data) => {
                  saveDocument(data)
                  mutate()
                }}
              />
            }
          </div>
          <div className={`duration-500 transition-flex ${commentActive !== 'Inactive' ? 'flex-[0]' : 'flex-1'}`}/>
         { commentActive === 'Complete' && 
          <CommentEditor onSubmit={(text) => {
            setCommentActive('Inactive')
            setCommentText([])
            if (pendingCommentRef) commitComment(editor, pendingCommentRef[1])
          }}
          onCancel={() => {
            setCommentActive('Inactive')
            setCommentText([])
            if (pendingCommentRef) cancelComment(editor, pendingCommentRef[1])
          }}
          comment={commentText}
          />
         }
        </div> 
      </Layout> 
    </>
  )
}