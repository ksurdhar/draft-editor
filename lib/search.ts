import { Node } from 'prosemirror-model'

interface Match {
  from: number
  to: number
}

export function findAllMatches(doc: Node, searchTerm: string): Match[] {
  const matches: Match[] = []
  if (!searchTerm) return matches

  const searchRegex = new RegExp(searchTerm, 'gi')

  doc.descendants((node, nodePos) => {
    if (node.isText) {
      let match
      while ((match = searchRegex.exec(node.text || '')) !== null) {
        matches.push({
          from: nodePos + match.index,
          to: nodePos + match.index + match[0].length,
        })
      }
    }
  })

  return matches
} 