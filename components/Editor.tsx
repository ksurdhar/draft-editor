import { useEffect, useRef, useState } from 'react'
import { Descendant, Editor, Node, Text, Transforms } from 'slate'
import { Editable, Slate } from 'slate-react'
import { HighlightColor, renderElement, renderLeaf } from '../lib/slate-renderers'
import { countWords, removePending } from '../lib/slate-utils'
import { useMouse } from '../pages/_app'
import { DocumentData, WhetstoneEditor } from '../types/globals'
import Footer from './footer'
import { useEditorFades } from './header'

type EditorProps = {
  id: string
  text: Descendant[]
  title: string
  editor: WhetstoneEditor
  commentActive: boolean
  openCommentId: string | null
  openComment: (isNewComment: boolean) => void
  onUpdate: (data: Partial<DocumentData>) => void
  canEdit: boolean
  hideFooter?: boolean
}

const getWordCountAtPosition = (nodes: Descendant[], rangeIdx: number, offset: number) => {
  let currentRowCount = 0
  const nodesBeforeSelection = nodes.slice(0, rangeIdx)
  const countExcludingCurrentRow = countWords(nodesBeforeSelection)
  const currentRow = nodes[rangeIdx]

  if (!!currentRow) {
    const rowMatch = Node.string(currentRow).slice(0, offset).match(/[a-zA-Z\d]+/g)
    currentRowCount = rowMatch?.length || 0
  }
  
  return countExcludingCurrentRow + currentRowCount
}

const setHighlight = (editor: WhetstoneEditor, color: HighlightColor) => {
  const [match] = Editor.nodes(editor, {
    match: n => Text.isText(n) && n.highlight === color,
    universal: true,
  })
  Transforms.setNodes(
    editor,
    { highlight: !!match ? undefined : color },
    { match: n => Text.isText(n), split: true }
  )
}

const EditorComponent = ({ id, text, title, editor, onUpdate, openComment, commentActive, openCommentId, canEdit, hideFooter }: EditorProps) => {
  const [ wordCount, setWordCount ] = useState(countWords(text))
  const [ wordCountAtPos, setWordCountAtPos ] = useState(0)
  const titleState = useRef(title)
  const titleRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { mouseMoved } = useMouse()
  const [ initFadeIn, fadeOut ] = useEditorFades(!mouseMoved)

  useEffect(() => {
    setTimeout(() => {
      const foundPending = removePending(editor)
      console.log('found pending comments to clean', foundPending)
    }, 200) // timeout is a hack, doesn't trigger onChange without a wait
  }, [editor])

  useEffect(() => {
    if (title.length === 0) {
      titleRef?.current?.focus()
    }
  }, [titleRef, title.length])

  return (
    <div className='flex-grow normal-case animate-fadein'>
      <div className='mb-[20px] mt-[44px]'>
        <div contentEditable={true} placeholder='New Title' ref={titleRef}
          className="editable mb-2 text-3xl md:text-4xl uppercase border-b border-transparent focus:outline-none active:outline-none" 
          spellCheck={false} 
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const containerNode = containerRef.current
              const documentNode = containerNode?.querySelector<HTMLTextAreaElement>(`[data-slate-editor="true"]`)
              documentNode?.focus()
            }
          }}
          onInput={(e) => {
            e.preventDefault()
            onUpdate({ title: `${e.currentTarget.textContent}` })
          }}
          suppressContentEditableWarning={true}
          dangerouslySetInnerHTML={{__html: titleState.current }}
        />
      </div>
      <div ref={containerRef}>
        <Slate editor={editor} key={id} value={text} 
          onChange={value => {
            const offset = editor.selection?.focus.offset || 0
            const position = editor.selection?.focus.path[0] || 0
            setWordCountAtPos(getWordCountAtPosition(value, position, offset))
            const isAstChange = editor.operations.some(
              op => 'set_selection' !== op.type
            )
            if (isAstChange) {
              setWordCount(countWords(value))
              const content = JSON.stringify(value)
              onUpdate({ content })
            }
          }}>
          <Editable
            readOnly={commentActive}
            spellCheck='false'
            className='rounded-md w-full h-full static text-[19px] md:text-[22px]'
            renderElement={renderElement}
            renderLeaf={(props) => {
              return renderLeaf({ ...props, openCommentId})
            }}
            onClick={event => {
              openComment(false)
            }}
            onKeyDown={event => {
              if (!canEdit) {
                event.preventDefault()
                return
              }
              if (event.metaKey) {
                switch (event.key) {
                  case '1': {
                    event.preventDefault()
                    openComment(true)
                    break
                  }
                  case '2': {
                    event.preventDefault()
                    setHighlight(editor, 'green')
                    break
                  }
                  case '3': {
                    event.preventDefault()
                    setHighlight(editor, 'orange')
                    break
                  }
                  case '4': {
                    event.preventDefault()
                    setHighlight(editor, 'red')
                    break
                  }
                }
              }
            }}
          />
        </Slate>
      </div>
      {
        !hideFooter &&
        <Footer 
          initFadeIn={initFadeIn} 
          fadeOut={fadeOut} 
          wordCount={wordCount} 
          wordCountAtPos={wordCountAtPos} 
        />
      }
      
    </div>
  )
}
export default EditorComponent
