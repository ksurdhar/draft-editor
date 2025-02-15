import { NodeEntry, Text, Transforms, Editor } from 'slate'
import { ReactEditor } from 'slate-react'
import { HistoryEditor } from 'slate-history'

export type FindDecoration = {
  anchor: { path: number[], offset: number }
  focus: { path: number[], offset: number }
  color: 'blue' | 'pending'
}

export type WhetstoneEditor = Editor & ReactEditor & HistoryEditor & {
  decorations: FindDecoration[]
  setDecorations: (decorations: FindDecoration[]) => void
  decorate: (entry: NodeEntry) => FindDecoration[]
}

export const withDecorations = (editor: Editor): WhetstoneEditor => {
  const e = editor as WhetstoneEditor
  e.decorations = []
  
  e.decorate = (entry: NodeEntry) => {
    let ranges: FindDecoration[] = []
    
    // Add our custom decorations
    if (Text.isText(entry[0])) {
      ranges = e.decorations.filter(dec => {
        const [, path] = entry
        return path.toString() === dec.anchor.path.toString()
      })
    }

    return ranges
  }

  e.setDecorations = (decorations: FindDecoration[]) => {
    console.log('Setting decorations:', decorations)
    e.decorations = decorations
    
    // Clear existing highlights
    console.log('Clearing existing highlights...')
    const [match] = Editor.nodes(e, {
      at: [],
      match: n => Text.isText(n) && n.highlight !== undefined,
    })
    if (match) {
      Transforms.unsetNodes(e, 'highlight', {
        at: [],
        match: n => Text.isText(n) && n.highlight !== undefined,
      })
    }

    // Set new highlights
    console.log('Setting new highlights...')
    decorations.forEach(dec => {
      const range = { anchor: dec.anchor, focus: dec.focus }
      const highlightColor = dec.color === 'blue' ? 'blue' : 'pending'
      console.log('Setting highlight:', { range, color: highlightColor })

      Transforms.setNodes(
        e,
        { highlight: highlightColor },
        { match: n => Text.isText(n), at: range }
      )
    })

    // Log text nodes after setting highlights
    console.log('Text nodes after setting highlights:')
    for (const [node, path] of Editor.nodes(e, {
      at: [],
      match: n => Text.isText(n),
    })) {
      console.log('Node at path', path, ':', node)
    }
  }

  return e
} 