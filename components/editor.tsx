import { useDebouncedCallback } from 'use-debounce'
import { useCallback, useState } from 'react'
import { createEditor, BaseEditor, Descendant, Editor, Transforms, Text } from 'slate'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'
import API from '../lib/utils'

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
  switch(leaf.highlight) {
    case 'blue':
      highlighting = 'bg-blue-200'
      break
    case 'green':
      highlighting = 'bg-green-200'
      break
    case 'orange':
      highlighting = 'bg-orange-200'
      break
    case 'red':
      highlighting = 'bg-red-200'
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
}


const EditorComponent = ({ id, text }: EditorProps) => {
  const [ editor ] = useState(() => withReact(createEditor()))
  const [ isUpdated, setIsUpdated ] = useState(true)
  const debouncedSave = useDebouncedCallback(
    async (content: string) => { 
      await API.patch(`/api/documents/${id}`, { // create a wrapper function for better typing, this is a exit point
        content,
        lastUpdated: Date.now()
      }) 
      setIsUpdated(true)
    }, 1000
  )

  const handleChange = useCallback((stringifiedText: string) => {
    setIsUpdated(false)
    debouncedSave(stringifiedText)
  }, [])

  const renderLeaf = useCallback((props: any) => {
    return <Leaf {...props} />
  }, [])

  return (
    <div className='flex-grow'>
      { !isUpdated ? <span>Unsaved Changes</span> : <span>Saved</span>}
      <Slate editor={editor} key={id} value={text} 
        onChange={value => {
          const isAstChange = editor.operations.some(
            op => 'set_selection' !== op.type
          )
          if (isAstChange) {
            const content = JSON.stringify(value)
            handleChange(content)
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
    </div>
  )
}

export default EditorComponent
