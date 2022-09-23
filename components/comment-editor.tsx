import { useEffect, useRef, useState } from 'react'
import { createEditor, Descendant } from 'slate'
import { Slate, Editable, withReact } from 'slate-react'
import { renderElement, renderLeaf } from './editor'

interface CommentEditorProps {
  onSubmit: (text: string) => void
  onCancel: () => void
  comment: Descendant[]
}

const CommentEditor = ({ onSubmit, onCancel, comment }: CommentEditorProps) => {
  const [ editor ] = useState(() => withReact(createEditor()))
  const [ text, setText ] = useState<Descendant[]>(comment)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTimeout(() => {
      const containerNode = containerRef.current
      const documentNode = containerNode?.querySelector<HTMLTextAreaElement>(`[data-slate-editor="true"]`)
      documentNode?.focus()
    }, 0)
  }, [])

  return (
    <div className={`flex flex-1 flex-col h-[75vh] justify-center m-[10px]`}>
      <div className={`fixed p-10 min-w-[100px]`} ref={containerRef}>
        <Slate editor={editor} value={text} 
          onChange={value => {
            const isAstChange = editor.operations.some(op => 'set_selection' !== op.type)
            if (isAstChange) {
              setText(value)
            }
          }}>
          <Editable
            spellCheck='false'
            className='rounded-md w-full h-full static text-[19px] md:text-[22px]'
            renderElement={renderElement}
            renderLeaf={renderLeaf}
          />
        </Slate>
        <div className={'mt-8 flex justify-evenly w-[calc(100vw_-_850px)]'}>
        <button className={'file-button'} onClick={() => onSubmit(JSON.stringify(text))}>
          submit
        </button>
        <button className={'file-button file-button-red'} onClick={() => onCancel()}>
          cancel
        </button>
        </div>
        
      </div>
    </div>
  )
}

export default CommentEditor