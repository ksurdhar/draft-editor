import { Dispatch, SetStateAction, useEffect, useRef } from "react"
import { Descendant, Location, Node, NodeEntry, Editor as SlateEditor, Text, Transforms } from "slate"
import { WhetstoneEditor } from "../types/globals"
import { DefaultText } from "./slate-renderers"

export const useEffectOnlyOnce = (callback: any, dependencies: any, condition: any) => {
  const calledOnce = useRef(false)

  useEffect(() => {
    if (calledOnce.current) {
      return
    }

    if (condition(dependencies)) {
      callback(dependencies)

      calledOnce.current = true
    }
  }, [callback, condition, dependencies])
}

export const captureCommentRef = (editor: WhetstoneEditor, setPendingCommentRef: Dispatch<SetStateAction<NodeEntry<Node> | null>>) => {
  Transforms.setNodes(
    editor,
    { highlight: 'pending' },
    { match: n => Text.isText(n), split: true } // do we want split here?
  )

  const [match] = SlateEditor.nodes(editor, {
    match: n => Text.isText(n) && n.highlight === 'pending',
    universal: true,
  })
  setPendingCommentRef(match)
}

export const commitComment = (editor: WhetstoneEditor, location: Location, commentId: string) => {
  Transforms.setNodes(
    editor,
    { highlight: 'comment', commentId },
    { match: n => Text.isText(n) && n.highlight === 'pending', at: [] }
  )
  removePending(editor) // helps clean up
}

export const removeComment = (editor: WhetstoneEditor, commentId: string) => {
  Transforms.setNodes(
    editor,
    { highlight: undefined, commentId: undefined },
    { match: n => Text.isText(n) && n.commentId === commentId, at: [] }
  )
}

export const removePending = (editor: WhetstoneEditor) => {
  const nodes = SlateEditor.nodes(editor, {
    match: n => Text.isText(n) && n.highlight === 'pending',
    mode: 'all',
    at: [] // scans whole document
  })
  let match = false
  for (const node of nodes) {
    match = true
    Transforms.setNodes(
      editor,
      { highlight: undefined },
      { at: node[1] }
    )
  }
  return match
}

export const cancelComment = (editor: WhetstoneEditor) => {
  Transforms.setNodes(
    editor,
    { highlight: undefined },
    { match: n => Text.isText(n) && n.highlight === 'pending', at: [] }
  )
}

export const checkForComment = (editor: WhetstoneEditor) => {
  const [match] = SlateEditor.nodes(editor, {
    match: n => Text.isText(n) && n.highlight === 'comment',
    at: editor.selection?.focus
  })
  if (!!match) {
    const textNode = match[0] as DefaultText
    return textNode.commentId
  }
  return null
}

// needs to be reworked to be more accurate
export const countWords = (nodes: Descendant[]) => {
  const wordCount = nodes.map((n) => Node.string(n)).join(' ').match(/[a-zA-Z\d]+/g)
  return wordCount?.length || 0
}