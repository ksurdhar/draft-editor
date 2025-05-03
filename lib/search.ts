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
  // Escape special regex characters to treat the search term as literal text
  let pattern = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`
  }
  const flags = options.matchCase ? 'g' : 'gi'

  const searchRegex = new RegExp(pattern, flags)

  doc.descendants((node, nodePos) => {
    if (node.isText) {
      let match
      searchRegex.lastIndex = 0 // Reset regex state before each use

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
