import { Node } from 'prosemirror-model'

interface Match {
  from: number
  to: number
}

interface SearchOptions {
  matchCase: boolean
  wholeWord: boolean
}

export function findAllMatches(
  doc: Node,
  searchTerm: string,
  options: SearchOptions = { matchCase: false, wholeWord: false },
): Match[] {
  const matches: Match[] = []
  if (!searchTerm) return matches

  // Create regex pattern based on options
  let pattern = searchTerm
  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`
  }
  const flags = options.matchCase ? 'g' : 'gi'
  const searchRegex = new RegExp(pattern, flags)

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
