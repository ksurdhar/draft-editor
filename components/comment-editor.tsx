import { useEffect, useRef, useState } from 'react'
import { createEditor, Descendant } from 'slate'
import { withHistory } from 'slate-history'
import { Slate, Editable, withReact } from 'slate-react'
import { renderElement, renderLeaf } from './editor'

const CommentEditor = () => {
  const [ editor ] = useState(() => withReact(withHistory(createEditor())))
  const [ text, setText ] = useState<Descendant[]>([{ type: 'default', children: [{text: 'hello world', highlight: 'none'}]}])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef?.current?.focus()
  }, [])

  return (
    <div className={`flex flex-1 flex-col h-[75vh] justify-center m-[10px]`}>
      <div className={`fixed p-10 bg-slate-400`} ref={containerRef}>
        <Slate editor={editor} value={text} 
          onChange={value => {
            const isAstChange = editor.operations.some(op => 'set_selection' !== op.type)
            if (isAstChange) {
              // const content = JSON.stringify(value)
              // handleChange({ content })
              console.log('onchange', value)
            }
          }}>
          <Editable
            spellCheck='false'
            className='rounded-md w-full h-full static text-[19px] md:text-[22px]'
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            onKeyDown={event => {
              console.log('onkeydown', event.currentTarget)
            }}
          />
        </Slate>
      </div>
    </div>
  )
}

export default CommentEditor