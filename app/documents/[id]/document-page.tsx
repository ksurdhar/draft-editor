'use client'
import Editor from '@components/editor'
import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { CloudIcon } from '@heroicons/react/solid'
import { useSpinner, useSyncHybridDoc } from '@lib/hooks'
import API, { fetcher } from '@lib/http-utils'
import { cancelComment, captureCommentRef, checkForComment, commitComment, removeComment } from '@lib/slate-utils'
import { AnimationState, CommentData, DocumentData } from '@typez/globals'
import { useUser } from '@wrappers/auth-wrapper-client'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
const CommentEditor = dynamic(() => import('@components/comment-editor'))

import { useCallback, useEffect, useState } from 'react'
import { Descendant, Node, NodeEntry, createEditor } from 'slate'
import { withHistory } from 'slate-history'
import { withReact } from 'slate-react'
import useSWR, { mutate } from 'swr'
import { useDebouncedCallback } from 'use-debounce'

const backdropStyles = `
  fixed top-0 left-0 h-screen w-screen z-[-1]
  transition-opacity ease-in-out duration-[3000ms]
`

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

export default function DocumentPage() {  
  const pathname = usePathname()
  const id = (pathname || '').split('/').pop() || ''
  const [ editor ] = useState(() => withReact(withHistory(createEditor())))
  
  const { data: databaseDoc } = useSWR<DocumentData, Error>(`/api/documents/${id}`, fetcher) 
  const [ hybridDoc, setHybridDoc ] = useState<DocumentData | null>()
  useSyncHybridDoc(id, databaseDoc, setHybridDoc)

  const showSpinner = useSpinner(!hybridDoc)
  
  const { isLoading } = useUser()
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
    await mutate(`/api/documents/${id}`)
    if (pendingCommentRef) commitComment(editor, pendingCommentRef[1], commentId)
  }, [hybridDoc, pendingCommentRef, editor, id])

  const deleteComment = async () => {
    if (!openCommentId) return
    removeComment(editor, openCommentId)

    const comments = hybridDoc?.comments.filter((comment) => comment.id !== openCommentId)
    await save({ comments }, id, setRecentlySaved)
    await mutate(`/api/documents/${id}`)

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
    await mutate(`/api/documents/${id}`)
    if (pendingCommentRef) {
      commitComment(editor, pendingCommentRef[1], commentId)
    }
  }, [hybridDoc, pendingCommentRef, editor, id])

  const cleanCommentState = useCallback(() => {
    setOpenCommentId(null)
    setCommentActive('Inactive')
    setCommentText([])
  }, [setCommentText, setOpenCommentId])

  const openComment = useCallback((isNewComment: boolean) => {
    const commentId = checkForComment(editor)
    const comment = hybridDoc?.comments.find((c) => c.id === commentId)
  
    if (commentId && comment && comment.content) {
      setOpenCommentId(commentId)
      setCommentText(JSON.parse(comment.content)) 
      setCommentActive('Active')
    } 
    if (isNewComment) {
      captureCommentRef(editor, setPendingCommentRef)
      setCommentText([{ type: 'default', children: [{text: ''}]}])
      setCommentActive('Active')
    }
  }, [hybridDoc, editor, setCommentText, setCommentActive, setPendingCommentRef, setOpenCommentId])

  const debouncedSave = useDebouncedCallback((data: Partial<DocumentData>) => {
    mutate(`/api/documents/${id}/versions`)
    save(data, id, setRecentlySaved)
    mutate(`/api/documents/${id}`)
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
    setTimeout(() => {
      setInitAnimate(true)
    }, 250)
  }, [isLoading, setInitAnimate])

  return (
    <Layout documentId={id}>
      <div className={`gradient ${initAnimate ? 'opacity-0' : 'opacity-100' } ${backdropStyles}`}/>
      <div className={`gradient-editor ${initAnimate ? 'opacity-100' : 'opacity-0' } ${backdropStyles}`}/>
      { recentlySaved && (
        <div className={`fixed top-0 right-[30px] z-[40] p-[20px]`}>
          <CloudIcon className='animate-bounce fill-black/[.10] md:fill-black/[.15] h-[20px] w-[20px] md:h-[24px] md:w-[24px] self-center'/>
        </div>
      )}
      <div id='editor-container' className={`flex justify-center h-[100vh] overflow-y-scroll pb-10 p-[20px] text-black/[.79] font-editor2`}>
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
                debouncedSave(data)
              }}
              canEdit={!!hybridDoc.canEdit}
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
  )
}