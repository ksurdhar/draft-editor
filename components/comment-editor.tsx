import Button from '@mui/material/Button'
import { useEffect, useRef, useState } from 'react'
import { Descendant, createEditor } from 'slate'
import { Editable, Slate, withReact } from 'slate-react'
import { renderElement, renderLeaf } from '../lib/slate-renderers'

interface CommentEditorProps {
  onSubmit: (text: string) => void
  onCancel: () => void
  comment: Descendant[]
  isPending: boolean
  deleteComment: () => void
}

const CommentEditor = ({ onSubmit, onCancel, deleteComment, comment, isPending }: CommentEditorProps) => {
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
      <div className={`fixed pl-8 pr-8 w-[-webkit-fill-available] border-l border-l-gray-700 h-[50%] flex flex-col justify-end max-w-[740px]`} ref={containerRef}>
        <div className={`flex flex-col justify-center h-[calc(100%_-_56px)]`}>
          <div className={`h-[fit-content] overflow-y-scroll justify-center`}>
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
          </div>
        </div>
        <div className={'mt-4 flex justify-end'}>
          <Button onClick={() => onSubmit(JSON.stringify(text))}>
            { isPending ? 'submit' : 'save' }
          </Button>
          { 
            !isPending && 
            <Button onClick={() => deleteComment() }>
              delete
            </Button>
          }
          <Button onClick={() => onCancel()}>
            cancel
          </Button>
      </div>
      </div>
    </div>
  )
}

export default CommentEditor