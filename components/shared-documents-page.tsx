'use client'

import Layout from '@components/layout'
import { Loader } from '@components/loader'
import { DotsHorizontalIcon } from '@heroicons/react/solid'
import { useSpinner } from '@lib/hooks'
import { DocumentData } from '@typez/globals'
import { format } from 'date-fns'
import Link from 'next/link'
import { useState } from 'react'

export interface SharedDocumentsPageProps {
  docs: DocumentData[]
  isLoading: boolean
  deleteDocument: (id: string) => void
  renameDocument: (id: string, title: string) => void
  navigateTo: (path: string) => void
}

const SharedDocumentsPage = ({
  docs,
  isLoading,
  navigateTo,
  deleteDocument,
  renameDocument,
}: SharedDocumentsPageProps) => {
  const [selectedDocId, setSelectedDoc] = useState<string | null>(null)
  const [renameActive, setRenameActive] = useState(false)
  const [newName, setNewName] = useState('')
  const showSpinner = useSpinner(isLoading)

  const documentItems = docs.map(({ id, title, lastUpdated }, idx) => {
    return (
      <div
        className={`
          flex min-h-[40px] animate-fadein
          justify-between border-solid border-black/[.35] px-[10px]
          text-[14px] font-semibold 
          uppercase transition duration-[250ms]
          hover:cursor-pointer hover:bg-white/[.30]
          ${id === selectedDocId ? 'border-black/[.14] bg-white/[.30]' : ''}
          ${selectedDocId && id !== selectedDocId ? 'pointer-events-none opacity-40' : ''} 
          ${idx !== docs.length - 1 ? 'border-b' : 'border-transparent'} 
        `}
        onClick={() => {
          if (!selectedDocId) {
            navigateTo(`/documents/${id}`)
          }
        }}
        key={id}>
        <div className="grow self-center overflow-hidden text-ellipsis whitespace-nowrap">
          <Link href={`/documents/${id}`}>{title}</Link>
        </div>
        <div className="w-28 min-w-[7rem] self-center text-black/[.65] md:w-44 md:min-w-[11rem]">
          {format(new Date(lastUpdated), 'PP')}
        </div>
        <div className="flex items-center">
          <div
            className="flex h-[28px] w-[28px] flex-col justify-center rounded-full hover:bg-black/[.10]"
            onClick={async e => {
              e.stopPropagation()
              if (selectedDocId === id) {
                setSelectedDoc(null)
              } else {
                setSelectedDoc(id)
              }
            }}>
            <DotsHorizontalIcon className="h-[16px] w-[16px] self-center" />
          </div>
        </div>
      </div>
    )
  })

  const emptyMessage = (
    <div className={'text-center text-[14px] font-semibold uppercase text-black/[.5]'}>
      Empty / Go create something of worth
    </div>
  )

  return (
    <>
      <Layout>
        <div className="gradient absolute left-0 top-0 z-[-1] h-screen w-screen" />
        <div
          className="relative top-[44px] flex h-[calc(100vh_-_44px)] justify-center pb-10"
          onClick={() => {
            if (selectedDocId || renameActive) {
              setSelectedDoc(null)
              setTimeout(() => setRenameActive(false), 251) // bit of a hack to prevent animations
            }
          }}>
          <div className={'flex w-11/12 max-w-[740px] flex-col justify-center sm:w-9/12'}>
            <div className="max-h-[280px] overflow-y-scroll">
              {showSpinner && <Loader />}
              {documentItems}
              {!isLoading && docs.length === 0 && emptyMessage}
            </div>

            {/* the selected item's 'menu' area  */}
            <div
              className={`${
                selectedDocId ? 'opacity-100' : 'pointer-events-none opacity-0'
              } mt-[48px] flex h-[40px] justify-evenly transition-opacity duration-[250ms]`}>
              {!renameActive && (
                <>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setRenameActive(true)
                    }}
                    className="file-button hover:bg-white/[.15]"
                    role="button">
                    rename
                  </button>
                  <button
                    onClick={async e => {
                      e.stopPropagation()
                      deleteDocument(selectedDocId as string)
                    }}
                    className="file-button file-button-red hover:bg-white/[.15]"
                    role="button">
                    delete
                  </button>
                </>
              )}
              {renameActive && (
                <form
                  className={'w-[70%]'}
                  onSubmit={async e => {
                    e.preventDefault()
                    renameDocument(selectedDocId as string, newName)
                    setSelectedDoc(null)
                    setRenameActive(false)
                  }}>
                  <input
                    onChange={e => setNewName(e.currentTarget.value)}
                    onClick={e => e.stopPropagation()}
                    type="text"
                    spellCheck="false"
                    autoFocus
                    placeholder={`New Title`}
                    className={`w-[100%] border-x-0 border-b-[1px] border-t-0 bg-transparent text-center font-editor2 text-[18px] 
                  uppercase text-black/[.70] ring-transparent placeholder:text-black/[.25] focus:border-black/[.2] focus:ring-transparent`}
                  />
                </form>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}

export default SharedDocumentsPage
