import { createEditor, BaseEditor, Descendant, Editor, Transforms, Text, Node } from 'slate'
import { HistoryEditor, withHistory } from 'slate-history'
import { Slate, Editable, withReact, ReactEditor } from 'slate-react'

interface CommentEditorProps {
  commentActive: boolean
}

const CommentEditor = ({ commentActive }: CommentEditorProps) => {
  // add editor and slate
  return (
    <div className={`transition-flex ${commentActive ? 'flex-1' : 'flex-[0]'} h-[200px]`}>
      hello world
    </div>
  )
}

export default CommentEditor