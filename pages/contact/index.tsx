import { useState } from 'react'
import { createEditor, BaseEditor, Descendant, Editor, Transforms } from 'slate'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

import Layout from "../../components/layout"

type DefaultText = { type: 'default', text: string }

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

const BodyElement = ({ attributes, children} : RenderElementProps)  => {
  return (
    <div {...attributes}>
      <div>{children}</div>
    </div>
  )
}
const Group1Element = ({ attributes, children} : RenderElementProps)  => {
  return (
    <div {...attributes}>
      <div className='bg-orange-300'>{children}</div>
    </div>
  )
}
const Group2Element = ({ attributes, children} : RenderElementProps)  => {
  return (
    <div {...attributes}>
      <div className='bg-blue-300'>{children}</div>
    </div>
  )
}
const Group3Element = ({ attributes, children} : RenderElementProps)  => {
  return (
    <div {...attributes}>
      <div className='bg-green-300'>{children}</div>
    </div>
  )
}

const initialValue: Descendant[] = [
  {
    type: 'default',
    children: [{ text: 'this is the slate component!', type: 'default' }],
  },
]


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

const ContactPage = () => {  
  const [ editor ] = useState(() => withReact(createEditor()))

  return (
    <Layout>
      <h1>Contact Page</h1>
      <Slate editor={editor} value={initialValue}>
        <Editable 
          renderElement={renderElement}
          onKeyDown={event => {
            if (event.metaKey) {
              switch (event.key) {
                case '1': {
                  event.preventDefault()
                  const [match] = Editor.nodes(editor, {
                    match: n => Editor.isBlock(editor, n) && n.type === 'group1',
                  })
                  Transforms.setNodes(
                    editor,
                    { type: match ? 'default' : 'group1' },
                    { match: n => Editor.isBlock(editor, n) }
                  )
                  break
                }
                case '2': {
                  event.preventDefault()
                  const [match] = Editor.nodes(editor, {
                    match: n => Editor.isBlock(editor, n) && n.type === 'group2',
                  })
                  Transforms.setNodes(
                    editor,
                    { type: match ? 'default' : 'group2' },
                    { match: n => Editor.isBlock(editor, n) }
                  )
                  break
                }
                case '3': {
                  event.preventDefault()
                  const [match] = Editor.nodes(editor, {
                    match: n => Editor.isBlock(editor, n) && n.type === 'group3',
                  })
                  Transforms.setNodes(
                    editor,
                    { type: match ? 'default' : 'group3' },
                    { match: n => Editor.isBlock(editor, n) }
                  )
                  break
                }
              }
            }
          }}
        />
      </Slate>
    </Layout>
  )
}

export default ContactPage