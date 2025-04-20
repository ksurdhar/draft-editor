/**
 * Utility functions for working with TipTap content
 */

/**
 * Extracts plain text from a TipTap document structure
 * @param doc TipTap document object or JSON string
 * @returns Plain text representation of the document
 */
export function flattenTiptapContent(doc: any): string {
  if (typeof doc === 'string') {
    try {
      doc = JSON.parse(doc)
    } catch (e) {
      return doc
    }
  }

  let text = ''

  const traverse = (node: any) => {
    // Handle string nodes
    if (typeof node === 'string') {
      text += node
      return
    }

    // Handle special node types
    if (node.type === 'hardBreak') {
      text += '\n'
      return
    }

    // Handle text nodes (with potential line breaks in them)
    if (node.text) {
      text += node.text
      return
    }

    // Process child nodes recursively
    if (node.content && Array.isArray(node.content)) {
      for (let i = 0; i < node.content.length; i++) {
        const child = node.content[i]

        traverse(child)

        // Add appropriate spacing based on node types
        if (i < node.content.length - 1) {
          // Add double newline after paragraphs
          if (child.type === 'paragraph') {
            text += '\n\n'
          }
        }
      }
    }
  }

  traverse(doc)
  return text
}

/**
 * Converts a conversation entries array to a plain text representation
 * @param entries Array of conversation entries with character and text fields
 * @returns Plain text representation of the conversation
 */
export function conversationEntriesToText(entries: Array<{ character: string; text: string }>): string {
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return ''
  }

  return entries.map(entry => `${entry.character}: ${entry.text}`).join('\n')
}
