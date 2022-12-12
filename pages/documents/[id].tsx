import { useUser } from "@auth0/nextjs-auth0"
import { CloudIcon } from "@heroicons/react/solid"
import { GetServerSideProps, InferGetServerSidePropsType } from "next"
import Head from "next/head"
import Router from "next/router"
import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react"
import { createEditor, Descendant, Node, NodeEntry } from "slate"
import { withHistory } from "slate-history"
import { withReact } from "slate-react"
import useSWR from "swr"
import { useDebouncedCallback } from "use-debounce"
import CommentEditor from "../../components/comment-editor"
import Editor, { DefaultText } from "../../components/editor"
import Layout from "../../components/layout"
import { Loader } from "../../components/loader"
import { useSpinner } from "../../lib/hooks"
import API, { fetcher } from "../../lib/utils"
import { AnimationState, CommentData, DocumentData } from "../../types/globals"
import { cancelComment, captureCommentRef, checkForComment, commitComment, removeComment } from "./slateUtils"

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

const save = async (data: Partial<DocumentData>, id: string, setRecentlySaved: (bool: boolean) => void) => {
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
}

export default function DocumentPage({ id }: InferGetServerSidePropsType<typeof getServerSideProps>) {  
  const [ editor ] = useState(() => withReact(withHistory(createEditor())))
  
  const { data: databaseDoc, error, mutate } = useSWR<DocumentData, Error>(`/api/documents/${id}`, fetcher) 
  const [ hybridDoc, setHybridDoc ] = useState<DocumentData | null>()
  useSyncHybridDoc(id, databaseDoc, setHybridDoc)

  const showSpinner = useSpinner(!hybridDoc)
  
  const { user, isLoading } = useUser()
  const [ initAnimate, setInitAnimate ] = useState(false)
  const [ recentlySaved, setRecentlySaved ] = useState(false)

  const [ commentText, setCommentText ] = useState<Descendant[]>([])
  const [ commentActive, setCommentActive ] = useState<AnimationState>('Inactive')
  const [ pendingCommentRef, setPendingCommentRef ] = useState<NodeEntry<Node> | null>(null)
  const [ openCommentId, setOpenCommentId ] = useState<string | null>(null)

  const addComment = useCallback(async (content: string) => {
    const timestamp = Date.now()
    const commentId = timestamp.toString()
    const comment: CommentData = {
      id: commentId,
      content,
      timestamp
    }
    const comments = hybridDoc?.comments.concat(comment)
    await save({ comments }, id, setRecentlySaved)
    await mutate()
    if (pendingCommentRef) commitComment(editor, pendingCommentRef[1], commentId)
  }, [hybridDoc, pendingCommentRef])

  const deleteComment = async () => {
    if (!openCommentId) return
    removeComment(editor, openCommentId)

    const comments = hybridDoc?.comments.filter((comment) => comment.id !== openCommentId)
    await save({ comments }, id, setRecentlySaved)
    await mutate()

    cleanCommentState()
  }

  const updateComment = useCallback(async (content: string, commentId: string) => {
    const comments = hybridDoc?.comments.map((comment) => {
      if (comment.id === commentId) {
        return { ...comment, content}
      }
      return comment
    })
    await save({ comments }, id, setRecentlySaved)
    await mutate()
    if (pendingCommentRef) commitComment(editor, pendingCommentRef[1], commentId)
  }, [hybridDoc, pendingCommentRef])

  const cleanCommentState = useCallback(() => {
    setOpenCommentId(null)
    setCommentActive('Inactive')
    setCommentText([])
  }, [setCommentText, setCommentText, setOpenCommentId])

  const openComment = useCallback((isNewComment: boolean) => {
    if (!hybridDoc) return 

    const commentId = checkForComment(editor)
    const comment = hybridDoc.comments.find((c) => c.id === commentId)
  
    if (commentId && comment && comment.content) {
      setOpenCommentId(commentId)
      setCommentText(JSON.parse(comment.content)) 
      setCommentActive('Active')
    } else if (isNewComment) {
      captureCommentRef(editor, setPendingCommentRef)
      setCommentText([{ type: 'default', children: [{text: ''}]}])
      setCommentActive('Active')
    }
  }, [hybridDoc, editor, setCommentText, setCommentActive, captureCommentRef, setPendingCommentRef, setOpenCommentId])

  const debouncedSave = useDebouncedCallback((data: Partial<DocumentData>) => {
    save(data, id, setRecentlySaved)
  }, 1000)

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
      // Router.push('/')
      console.log('no user!')
    }
    setTimeout(() => {
      setInitAnimate(true)
    }, 250)
  }, [isLoading, setInitAnimate])

  // if (!isLoading && !user ) return <>you are not authorized to view</>

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
        <div className={`flex justify-center h-[calc(100vh_-_64px)] overflow-y-scroll pb-10 p-[20px] mt-[64px] text-black/[.79] font-editor2`}>
          <div className={`
              duration-500 transition-flex
              flex ease-in ${showSpinner ? 'justify-center flex-col mt-[-36px]' : ''}
              relative max-w-[740px] min-w-[calc(100vw_-_40px)] md:min-w-[0px] pb-10`}>
            { showSpinner && <Loader/> }
            { hybridDoc && 
              <Editor id={id} 
                text={JSON.parse(hybridDoc.content)}
                editor={editor}
                commentActive={commentActive !== 'Inactive'}
                openCommentId={openCommentId}
                openComment={openComment}
                title={hybridDoc.title} 
                onUpdate={(data) => {
                  console.log('update')
                  debouncedSave(data)
                  mutate()
                }}
              />
            }
          </div>
          <div className={`
            duration-500 transition-flex ${commentActive !== 'Inactive' ? 'flex-[1]' : 'flex-0'}
            max-w-[740px]
          `}>
          { commentActive === 'Complete' && 
            <CommentEditor 
              comment={commentText}
              isPending={!Boolean(openCommentId)} 
              onSubmit={(text) => {
                openCommentId ? updateComment(text, openCommentId) : addComment(text)            
                cleanCommentState()
              }}
              onCancel={() => {
                cleanCommentState()
                if (pendingCommentRef) cancelComment(editor)
              }}
              deleteComment={deleteComment}
            />}
         </div>
        </div> 
      </Layout> 
    </>
  )
}