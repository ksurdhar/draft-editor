import { Node } from 'prosemirror-model'

interface Match {
  from: number
  to: number
}

interface SearchOptions {
  matchCase: boolean
  wholeWord: boolean
}

/**
 * Finds all matches of a search term in a document
 * Only matches within single text nodes
 */
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

/**
 * Find dialogue snippets in the document, even if they span multiple paragraphs
 * This is specifically for dialogue detection where snippets may be split across nodes
 */
export function findDialogueSnippet(doc: Node, dialogueSnippet: string): Match[] {
  // No snippet to search for
  if (!dialogueSnippet) return []

  // Try exact match first (faster)
  const exactMatches = findAllMatches(doc, dialogueSnippet)
  if (exactMatches.length > 0) {
    return exactMatches
  }

  // If no exact match, try splitting the dialogue by paragraph
  const paragraphs = dialogueSnippet.split(/\n+/)
  if (paragraphs.length <= 1) {
    // Still just one paragraph, no split needed
    return []
  }

  // Try to find matches for the first paragraph
  const firstParagraph = paragraphs[0].trim()
  if (!firstParagraph) return []

  const firstParaMatches = findAllMatches(doc, firstParagraph)
  if (firstParaMatches.length === 0) return []

  // For each potential start position, try to find following paragraphs
  const results: Match[] = []

  for (const firstMatch of firstParaMatches) {
    let valid = true
    let currentPos = firstMatch.to
    let endPos = firstMatch.to

    // Look for each subsequent paragraph
    for (let i = 1; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim()
      if (!para) continue

      // Find this paragraph in the document starting from current position
      let found = false

      // Search ahead in the document for the next paragraph
      doc.nodesBetween(currentPos, doc.content.size, (node, pos) => {
        if (!found && node.isText && node.text) {
          const text = node.text
          // Check if this node contains our paragraph text
          if (text.includes(para)) {
            const paraPos = text.indexOf(para)
            const absolutePos = pos + paraPos
            // Only consider it if it's after our current position
            if (absolutePos >= currentPos) {
              endPos = absolutePos + para.length
              currentPos = endPos
              found = true
              return false // Stop traversal
            }
          }
        }
        return !found // Continue traversal if not found
      })

      if (!found) {
        valid = false
        break
      }
    }

    if (valid) {
      results.push({
        from: firstMatch.from,
        to: endPos,
      })
    }
  }

  return results
}
