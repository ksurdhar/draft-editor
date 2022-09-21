import { createEditor, BaseEditor, Descendant, Editor, Transforms, Text, Node } from 'slate'
import { HistoryEditor, withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

// interface CommentEditorProps {
//   commentActive: boolean
// }

const CommentEditor = () => {
  // add editor and slate
  return (
    <div className={`flex flex-1 bg-slate-400 h-[100vh] m-[10px]`}>
      hello world
    </div>
  )
}

export default CommentEditor