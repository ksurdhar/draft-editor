import { useDebouncedCallback } from 'use-debounce'
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react'
import { createEditor, BaseEditor, Descendant, Editor, Transforms, Text, Node } from 'slate'
import { HistoryEditor, withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'
import API from '../lib/utils'
import { useEditorFades } from './header'
import { useMouse } from '../pages/_app'
import Footer from './footer'

type HighlightColor = 'red' | 'orange' | 'green' | 'blue' 
type HighlightType = 'none' | HighlightColor
type DefaultText = { text: string, highlight: HighlightType, comment?: string }
type DefaultElement = { type: 'default'; children: DefaultText[] }
type CustomElement = DefaultElement 

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor
    Element: CustomElement
    Text: DefaultText
  }
}

type RenderElementProps = {
  attributes: Object
  element: CustomElement
  children: React.ReactNode
}

const BodyElement = ({ attributes, children} : RenderElementProps) => {
  return (
    <div {...attributes}>
      <div className='transition'>{children}</div>
    </div>
  )
}

// this is where additional element types can be rendered
export const renderElement = (props: RenderElementProps) => {
  switch (props.element.type) {
    default:
      return <BodyElement {...props} />
  }
}

type RenderLeafProps = {
  attributes: Object
  leaf: DefaultText
  children: React.ReactNode
}

type ColorMap = Record<HighlightColor, string>

const Leaf = ({ attributes, leaf, children }: RenderLeafProps) => {
  let highlight = ''

  const colorMap: ColorMap = {
    blue: 'bg-blue-200',
    green: 'bg-green-200',
    orange: 'bg-orange-200',
    red: 'bg-red-200'
  }

  if (leaf.highlight !== 'none') {
    highlight = colorMap[leaf.highlight]
  }
  
  return (
    <span {...attributes} className={`transition duration-500 ${highlight}`}>
      {children}
    </span>
  )
}

export const renderLeaf = (props: any) => {
  return <Leaf {...props} />
}

type EditorProps = {
  id: string
  text: Descendant[]
  title: string
  commentActive: boolean
  setCommentActive: Dispatch<SetStateAction<AnimationState>>
  onUpdate: () => void
}

// needs to be reworked to be more accurate
const countWords = (nodes: Descendant[]) => {
  const wordCount = nodes.map((n) => Node.string(n)).join(' ').match(/[a-zA-Z\d]+/g)
  return wordCount?.length || 0
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

const setHighlight = (editor: BaseEditor & ReactEditor & HistoryEditor, color: HighlightType) => {
  const [match] = Editor.nodes(editor, {
    match: n => Text.isText(n) && n.highlight === color,
    universal: true,
  })
  Transforms.setNodes(
    editor,
    { highlight: !!match ? 'none' : color },
    { match: n => Text.isText(n), split: true }
  )
}

const EditorComponent = ({ id, text, title, onUpdate, setCommentActive, commentActive }: EditorProps) => {
  const [ editor ] = useState(() => withReact(withHistory(createEditor())))
  const [ wordCount, setWordCount ] = useState(countWords(text))
  const [ wordCountAtPos, setWordCountAtPos ] = useState(0)
  const titleState = useRef(title)
  const titleRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { mouseMoved } = useMouse()
  const [ initFadeIn, fadeOut ] = useEditorFades(!mouseMoved)

  useEffect(() => {
    if (title.length === 0) {
      titleRef?.current?.focus()
    }
  }, [titleRef])

  const debouncedSave = useDebouncedCallback(
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
      onUpdate()  
    }, 1000
  )

  const handleChange = useCallback((props: Partial<DocumentData>) => {
    debouncedSave(props)
  }, [debouncedSave])

  return (
    <div className='flex-grow normal-case animate-fadein'>
      <div className='mb-[20px]'>
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
            handleChange({ title: `${e.currentTarget.textContent}` })
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
              handleChange({ content })
            }
          }}>
          <Editable
            spellCheck='false'
            className='rounded-md w-full h-full static text-[19px] md:text-[22px]'
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            onKeyDown={event => {
              if (event.metaKey) {
                switch (event.key) {
                  case '1': {
                    event.preventDefault()
                    setHighlight(editor, 'blue')
                    // add comment entry point here
                    if (event.shiftKey) {
                      console.log('open comment')
                      const newCommentState: AnimationState = commentActive ? 'Inactive' : 'Active'
                      setCommentActive(newCommentState)
                    }
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
      <Footer 
        initFadeIn={initFadeIn} 
        fadeOut={fadeOut} 
        wordCount={wordCount} 
        wordCountAtPos={wordCountAtPos} 
      />
    </div>
  )
}
export default EditorComponent
