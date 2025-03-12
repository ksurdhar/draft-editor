export interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  marks?: { type: string }[]
}

/**
 * Transforms plain text content into Tiptap compatible JSON structure
 * @param text Plain text content with newlines
 * @returns Tiptap document node
 */
export function transformTextToTiptap(text: string): TiptapNode {
  console.log('Starting text transformation. Input text length:', text.length)
  console.log('First 100 chars of input:', text.substring(0, 100))

  // Split the text into paragraphs
  const paragraphs = text.split(/\r?\n\r?\n/).filter(p => p.trim().length > 0)
  console.log('Number of paragraphs:', paragraphs.length)
  console.log('First paragraph:', paragraphs[0])

  const doc = {
    type: 'doc',
    content: paragraphs.map((paragraph, pIndex) => {
      // Split paragraph into lines for handling line breaks within paragraphs
      const lines = paragraph.split(/\r?\n/).filter(line => line.length > 0)
      console.log(`Paragraph ${pIndex + 1} has ${lines.length} lines`)

      const paragraphNode = {
        type: 'paragraph',
        content: lines
          .map((line, index) => {
            const nodes: TiptapNode[] = []

            if (index > 0) {
              nodes.push({ type: 'hardBreak' })
            }

            nodes.push({
              type: 'text',
              text: line || ' ', // Ensure we never have empty text nodes
            })

            return nodes
          })
          .flat(),
      }

      // If paragraph is empty, ensure it has at least one text node
      if (!paragraphNode.content || paragraphNode.content.length === 0) {
        paragraphNode.content = [{ type: 'text', text: ' ' }]
      }

      console.log(`Paragraph ${pIndex + 1} node:`, JSON.stringify(paragraphNode).substring(0, 100) + '...')
      return paragraphNode
    }),
  }

  // Ensure we have at least one paragraph if the document is empty
  if (!doc.content || doc.content.length === 0) {
    doc.content = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: ' ' }],
      },
    ]
  }

  console.log('Final document structure:', JSON.stringify(doc).substring(0, 200) + '...')
  return doc
}
