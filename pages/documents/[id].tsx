import { useUser } from "@auth0/nextjs-auth0"
import { CloudIcon } from "@heroicons/react/solid"
import { GetServerSideProps, InferGetServerSidePropsType } from "next"
import Head from "next/head"
import Router from "next/router"
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react"
import { createEditor, Descendant, Text, Transforms, Editor as SlateEditor, Element, Node, NodeEntry, Location } from "slate"
import { withHistory } from "slate-history"
import { withReact } from "slate-react"
import useSWR from "swr"
import { useDebouncedCallback } from "use-debounce"
import CommentEditor from "../../components/comment-editor"
import Editor, { DefaultText } from "../../components/editor"
import Layout from "../../components/layout"
import { Loader } from "../../components/loader"
import { useSpinner } from "../../lib/hooks"
import API from "../../lib/utils"
import { AnimationState, CommentData, DocumentData, WhetstoneEditor } from "../../types/globals"

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

const captureCommentRef = (editor: WhetstoneEditor, setPendingCommentRef: Dispatch<SetStateAction<NodeEntry<Node> | null>>) => {
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

const checkForComment = (editor: WhetstoneEditor) => {
  const [match] = SlateEditor.nodes(editor, {
    match: n => Text.isText(n) && n.highlight === 'comment',
    at: editor.selection?.focus
  })
  if (!!match) {
    const textNode = match[0] as DefaultText
    return textNode.commentId
  }
  return null
}

const removeComment = (editor: WhetstoneEditor, commentId: string) => {
  console.log('commentID', commentId)
  Transforms.setNodes(
    editor,
    { highlight: undefined, commentId: undefined },
    { match: n => Text.isText(n) && n.commentId === commentId, at: [] }
  )
}

const removePending = (editor: WhetstoneEditor) => {
  Transforms.setNodes(
    editor,
    { highlight: undefined },
    { match: n => Text.isText(n) && n.highlight === 'pending', at: [] }
  )
}

const cancelComment = (editor: WhetstoneEditor, location: Location) => {
  Transforms.setNodes(
    editor,
    { highlight: undefined }, // "removeComment" will be a different method than cancel comment
    { match: n => Text.isText(n) && n.highlight === 'pending', at: location }
  )
}

const commitComment = (editor: WhetstoneEditor, location: Location, commentId: string) => {
  Transforms.setNodes(
    editor,
    { highlight: 'comment', commentId },
    { match: n => Text.isText(n) && n.highlight === 'pending', at: location }
  )
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

const useEffectOnlyOnce = (callback: any, dependencies: any, condition: any) => {
  const calledOnce = useRef(false);

  useEffect(() => {
    if (calledOnce.current) {
      return;
    }

    if (condition(dependencies)) {
      callback(dependencies)

      calledOnce.current = true
    }
  }, [callback, condition, dependencies])
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

  const [ commentText, setCommentText ] = useState<Descendant[]>([])
  const [ commentActive, setCommentActive ] = useState<AnimationState>('Inactive')
  const [ pendingCommentRef, setPendingCommentRef ] = useState<NodeEntry<Node> | null>(null)
  const [ activeCommentId, setActiveCommentId ] = useState<string | null>(null)

  const addNewComment = useCallback(async (content: string) => {
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
    if (!activeCommentId) return
    removeComment(editor, activeCommentId)

    const comments = hybridDoc?.comments.filter((comment) => comment.id !== activeCommentId)
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
    setActiveCommentId(null)
    setCommentActive('Inactive')
    setCommentText([])
  }, [setCommentText, setCommentText, setActiveCommentId])

  const openComment = useCallback((allowBlankState: boolean) => {
    if (!hybridDoc) return 

    const commentId = checkForComment(editor)
    const comment = hybridDoc.comments.find((c) => c.id === commentId)
  
    if (commentId && comment && comment.content) {
      setActiveCommentId(commentId)
      setCommentText(JSON.parse(comment.content)) 
      setCommentActive('Active')
    } else if (allowBlankState) {
      captureCommentRef(editor, setPendingCommentRef)
      setCommentText([{ type: 'default', children: [{text: ''}]}])
      setCommentActive('Active')
    }
  }, [hybridDoc, editor, setCommentText, setCommentActive, captureCommentRef, setPendingCommentRef, setActiveCommentId])

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
      Router.push('/')
    }
    setTimeout(() => {
      setInitAnimate(true)
    }, 250)
  }, [isLoading, setInitAnimate])

  useEffectOnlyOnce(
    () => {
      console.log('on mount after document is truthy')
      setTimeout(() => removePending(editor), 0)
    }, [hybridDoc], 
    () => hybridDoc !== null
  )

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
        <div className={`flex h-[calc(100vh_-_64px)] overflow-y-scroll pb-10 p-[20px] mt-[64px] text-black/[.79] font-editor2`}>
          <div className={`duration-500 transition-flex ${commentActive !== 'Inactive' ? 'flex-[0]' : 'flex-1'}`}/>
          <div className={`flex ease-in ${showSpinner ? 'justify-center flex-col mt-[-36px]' : ''}
             relative max-w-[740px] min-w-[calc(100vw_-_40px)] md:min-w-[0px] pb-10`}>
            { showSpinner && <Loader/> }
            { hybridDoc && 
              <Editor id={id} text={JSON.parse(hybridDoc.content)}
                editor={editor}
                commentActive={commentActive !== 'Inactive'}
                activeCommentId={activeCommentId}
                openComment={openComment}
                title={hybridDoc.title} 
                onUpdate={(data) => {
                  debouncedSave(data)
                  mutate()
                }}
              />
            }
          </div>
          <div className={`duration-500 transition-flex ${commentActive !== 'Inactive' ? 'flex-[0]' : 'flex-1'}`}/>
         { commentActive === 'Complete' && 
          <CommentEditor 
            isPending={!Boolean(activeCommentId)} 
            onSubmit={(text) => {
              activeCommentId ? updateComment(text, activeCommentId) : addNewComment(text)            
              cleanCommentState()
            }}
            deleteComment={deleteComment}
            onCancel={() => {
              cleanCommentState()
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