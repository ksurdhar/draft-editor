import * as DiffMatchPatch from 'diff-match-patch'

const dmp = new DiffMatchPatch.diff_match_patch()

export interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  marks?: Array<{ type: string, attrs?: Record<string, any> }>
}

export interface TiptapDiff {
  type: string
  content?: TiptapDiff[]
  text?: string
  marks?: Array<{ type: string, attrs?: Record<string, any> }>
  diffType?: 'added' | 'removed'
}

function flattenTiptapContent(doc: any): string {
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc)
    } catch (e) {
      return doc
    }
  }

  let text = ''
  const traverse = (node: any) => {
    if (typeof node === 'string') {
      text += node
    } else if (node.text) {
      text += node.text
    } else if (node.content) {
      node.content.forEach((child: any, index: number) => {
        traverse(child)
        // Add double newline after paragraphs (except last one)
        if (child.type === 'paragraph' && index < node.content.length - 1) {
          text += '\n\n'
        }
      })
    }
  }

  traverse(doc)
  return text
}

type DiffTuple = [number, string]

function computeTextDiff(oldText: string, newText: string): DiffTuple[] {
  const diffs = dmp.diff_main(oldText, newText)
  dmp.diff_cleanupSemantic(diffs)
  return diffs
}

export function computeTiptapDiff(oldDoc: any, newDoc: any): TiptapDiff {
  const oldText = flattenTiptapContent(oldDoc)
  const newText = flattenTiptapContent(newDoc)
  
  // Get the diffs - diff_match_patch uses:
  // -1 for deletion (in old, not in new)
  // 1 for insertion (not in old, in new)
  // 0 for equal
  const diffs = computeTextDiff(oldText, newText)

  // Convert the diffs back into a Tiptap document structure
  const diffDoc: TiptapDiff = {
    type: 'doc',
    content: []
  }

  let currentParagraph: TiptapDiff = {
    type: 'paragraph',
    content: []
  }

  // Split diffs into paragraphs
  const paragraphs: DiffTuple[][] = [[]]
  let currentParagraphDiffs = paragraphs[0]

  diffs.forEach(([operation, text]) => {
    const parts = text.split('\n\n')
    parts.forEach((part, index) => {
      if (part) {
        currentParagraphDiffs.push([operation, part])
      }
      if (index < parts.length - 1) {
        // Start a new paragraph
        currentParagraphDiffs = []
        paragraphs.push(currentParagraphDiffs)
      }
    })
  })

  // Process each paragraph's diffs
  paragraphs.forEach(paragraphDiffs => {
    if (paragraphDiffs.length === 0) return

    currentParagraph = {
      type: 'paragraph',
      content: []
    }

    // Process the diffs within this paragraph
    paragraphDiffs.forEach(([operation, text]) => {
      if (!text) return

      // Create a text node with appropriate diff highlighting
      const textNode: TiptapDiff = {
        type: 'text',
        text: text
      }

      // Add diff highlighting marks if this is a change
      if (operation !== 0) {
        textNode.marks = [{
          type: 'diffHighlight',
          attrs: {
            // -1 means it was in old but not in new (removed)
            // 1 means it wasn't in old but is in new (added)
            type: operation === 1 ? 'added' : 'removed'
          }
        }]
      }

      currentParagraph.content?.push(textNode)
    })

    if (currentParagraph.content?.length) {
      diffDoc.content?.push(currentParagraph)
    }
  })

  // Ensure we have at least one paragraph
  if (!diffDoc.content?.length) {
    diffDoc.content = [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: ' '
      }]
    }]
  }

  return diffDoc
} 