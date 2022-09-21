import { createEditor, BaseEditor, Descendant, Editor, Transforms, Text, Node } from 'slate'
import { HistoryEditor, withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

// interface CommentEditorProps {
//   commentActive: boolean
// }

const CommentEditor = () => {
  // initial component is just a flex spacer
  // add an absolutely positioned 
  return (
    <div className={`flex flex-1 flex-col h-[80vh] justify-center m-[10px]`}>
      <div className={`fixed`}>
        hello world
        hello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello worldhello world
        hello worldhello worldhello worldhello world
        hello worldhello worldhello worldhello world
        hello worldhello worldhello world
      </div>
    </div>
  )
}

export default CommentEditor