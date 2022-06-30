import { useState } from 'react'
import { createEditor, BaseEditor, Descendant } from 'slate'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

import Layout from "../../components/layout"

type CustomElement = { type: 'paragraph'; children: CustomText[] }
type CustomText = { text: string }

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor
    Element: CustomElement
    Text: CustomText
  }
}

const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [{ text: 'this is the slate component!' }],
  },
]

const ContactPage = () => {  
  const [ editor ] = useState(() => withReact(createEditor()))

  return (
    <Layout>
      <h1>Contact</h1>
      <Slate editor={editor} value={initialValue}>
        <Editable 
          onKeyDown={event => {
            console.log(event.key)
          }}
        />
      </Slate>
    </Layout>
  )
}

export default ContactPage