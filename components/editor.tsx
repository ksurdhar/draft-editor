import { useDebouncedCallback } from 'use-debounce'
import { useCallback, useState } from 'react'
import { createEditor, BaseEditor, Descendant, Editor, Transforms, Text, Node } from 'slate'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'
import API from '../lib/utils'
import { useEditorFades } from './header'
import { useMouse } from '../pages/_app'

type HighlightType = 'none' | 'red' | 'orange' | 'green' | 'blue' 

type DefaultText = { text: string, highlight: HighlightType }
type DefaultElement = { type: 'default'; children: DefaultText[] }
type Group1Element = { type: 'group1'; children: DefaultText[] }
type Group2Element = { type: 'group2'; children: DefaultText[] }
type Group3Element = { type: 'group3'; children: DefaultText[] }
type CustomElement = DefaultElement | Group1Element | Group2Element | Group3Element

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
const Group1Element = ({ attributes, children} : RenderElementProps) => {
  return (
    <div {...attributes}>
      <div className={`transition`}>{children}</div>
    </div>
  )
}
const Group2Element = ({ attributes, children} : RenderElementProps) => {
  return (
    <div {...attributes}>
      <div className={`transition`}>{children}</div>
    </div>
  )
}
const Group3Element = ({ attributes, children} : RenderElementProps)  => {
  return (
    <div {...attributes}>
      <div className={`transition`}>{children}</div>
    </div>
  )
}

const renderElement = (props: RenderElementProps) => {
  switch (props.element.type) {
    case 'group1':
      return <Group1Element {...props} />
    case 'group2':
      return <Group2Element {...props} />
    case 'group3':
      return <Group3Element {...props} />
    default:
      return <BodyElement {...props} />
  }
}


type RenderLeafProps = {
  attributes: Object
  leaf: DefaultText
  children: React.ReactNode
}

const Leaf = ({ attributes, leaf, children }: RenderLeafProps) => {
  let highlighting = ''
  let selection = ''
  switch(leaf.highlight) {
    case 'blue':
      highlighting = 'bg-blue-200'
      // selection = 'selection:bg-blue-200'
      break
    case 'green':
      highlighting = 'bg-green-200'
      // selection = 'selection:bg-green-200'
      break
    case 'orange':
      highlighting = 'bg-orange-200'
      // selection = 'selection:bg-orange-200'
      break
    case 'red':
      highlighting = 'bg-red-200'
      // selection = 'selection:bg-red-200'
      break
  }
  
  return (
    <span {...attributes} className={`transition duration-500 ${highlighting}`}>
      {children}
    </span>
  )
}

type EditorProps = {
  id: string
  text: Descendant[]
  title: string
}

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

const EditorComponent = ({ id, text, title }: EditorProps) => {
  const [ editor ] = useState(() => withReact(createEditor()))
  const [ isUpdated, setIsUpdated ] = useState(true)
  const [ wordCount, setWordCount ] = useState(countWords(text))
  const [ wordCountAtPos, setWordCountAtPos ] = useState(0)
  const [ counterMode, setCounterMode ] = useState(0)

  const counterTexts = [
    `${wordCountAtPos}/${wordCount} words`,
    `page ${Math.ceil(wordCountAtPos/500)}/${Math.ceil(wordCount/500)}`,
    `${Math.round(wordCountAtPos/wordCount*100)}%`
  ]
    
  const { mouseMoved } = useMouse()
  const [ initFadeIn, fadeOut ] = useEditorFades(!mouseMoved)

  const debouncedSave = useDebouncedCallback(
    async (data: Partial<DocumentData>) => { 
      await API.patch(`/api/documents/${id}`, { // create a wrapper function for better typing
        ...data,
        lastUpdated: Date.now()
      }) 
      setIsUpdated(true)
    }, 1000
  )

  const handleChange = useCallback((props: Partial<DocumentData>) => {
    setIsUpdated(false)
    debouncedSave(props)
  }, [])

  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />
  }, [])

  return (
    <div className='flex-grow normal-case'>
      <div>
        <span contentEditable className="mb-2 text-3xl md:text-4xl uppercase border-b border-transparent focus:outline-none active:outline-none hover:border-dashed hover:border-b hover:border-slate-300" 
          spellCheck={false} 
          onKeyUpCapture={(e) => handleChange({ title: `${e.currentTarget.textContent}` })}
          suppressContentEditableWarning={true}
        >
          {title}
        </span>
      </div>
      
      { !isUpdated ? <span>Unsaved Changes</span> : <span>Saved</span>}

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
                  const [match] = Editor.nodes(editor, {
                    match: n => Text.isText(n) && n.highlight === 'red',
                    universal: true,
                  })
                  Transforms.setNodes(
                    editor,
                    { highlight: !!match ? 'none' : 'red' },
                    { match: n => Text.isText(n), split: true }
                  )
                  break
                }
                case '2': {
                  event.preventDefault()
                  const [match] = Editor.nodes(editor, {
                    match: n => Text.isText(n) && n.highlight === 'orange',
                    universal: true,
                  })
                  Transforms.setNodes(
                    editor,
                    { highlight: !!match ? 'none' : 'orange' },
                    { match: n => Text.isText(n), split: true }
                  )
                  break
                }
                case '3': {
                  event.preventDefault()
                  const [match] = Editor.nodes(editor, {
                    match: n => Text.isText(n) && n.highlight === 'green',
                    universal: true,
                  })
                  Transforms.setNodes(
                    editor,
                    { highlight: !!match ? 'none' : 'green' },
                    { match: n => Text.isText(n), split: true }
                  )
                  break
                }
                case '4': {
                  event.preventDefault()
                  const [match] = Editor.nodes(editor, {
                    match: n => Text.isText(n) && n.highlight === 'blue',
                    universal: true,
                  })
                  Transforms.setNodes(
                    editor,
                    { highlight: !!match ? 'none' : 'blue' },
                    { match: n => Text.isText(n), split: true }
                  )
                  break
                }
              }
            }
          }}
        />
      </Slate>
      
      {/* footer */}
      <div className={`fixed ${initFadeIn ? 'footer-gradient' : 'bg-transparent'} ${fadeOut ? 'opacity-0' : 'opacity-100' }  transition-opacity duration-700 hover:opacity-100 w-[100vw] h-[50px] bottom-0 left-0 z-10`}>
        <div className='font-index text-sm md:text-base pr-[20px] cursor-pointer fixed bottom-0 right-0' onClick={() => {
          if (counterMode < 2) {
            setCounterMode(counterMode + 1)
          } else {
            setCounterMode(0)
          }
        }}> 
          { counterTexts[counterMode] }
        </div>
      </div>
    </div>
  )
}
export default EditorComponent
