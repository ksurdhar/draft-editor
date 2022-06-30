import { useState } from 'react'
import { createEditor, BaseEditor, Descendant, Editor, Transforms } from 'slate'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

import Layout from "../../components/layout"

type DefaultText = { type: 'default', text: string }

type DefaultElement = { type: 'default'; children: DefaultText[] }
type Group1Element = { type: 'group1'; children: DefaultText[] }
type CustomElement = DefaultElement | Group1Element

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
      <span>{children}</span>
    </div>
  )
}
const Group1Element = ({ attributes, children} : RenderElementProps)  => {
  return (
    <div {...attributes}>
      <span className='bg-orange-300'>{children}</span>
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
            console.log(event.key)

            if(event.metaKey) {
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
              }
            }
          }}
        />
      </Slate>
    </Layout>
  )
}

export default ContactPage