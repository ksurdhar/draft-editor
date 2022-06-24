import React, { useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'

import API from '../lib/utils'

type EditorProps = {
  documentText: string
  documentId: string
}

const Editor = ({ documentText, documentId }: EditorProps) => {
  const [ text, setText ] = useState((documentText || ''))
  const [ isUpdated, setIsUpdated ] = useState(true)

  const debouncedSave = useDebouncedCallback(
    async () => { 
      setIsUpdated(false)
      await API.patch(`documents/${documentId}`, { content: text }) 
      setIsUpdated(true)
    }, 1000
  )

  const handleChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setText(e.currentTarget.value)
    debouncedSave()
  }

  return (
    <div className='flex-grow'>
      { !isUpdated ? <span>updating</span> : <span>up to date</span>}
      <textarea className='border-solid border-2 border-slate-300 rounded-md w-full h-full' value={text} onChange={handleChange} />
    </div>
  )
}

export default Editor
