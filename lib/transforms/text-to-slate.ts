export interface SlateNode {
  type: string
  children: Array<{
    text: string
    highlight: string
  }>
}

/**
 * Transforms plain text content into SlateJS compatible JSON structure
 * @param text Plain text content with newlines
 * @returns Array of SlateJS nodes
 */
export function transformTextToSlate(text: string): SlateNode[] {
  // Split the text into lines, preserving empty lines
  const lines = text.split(/\r?\n/)
  
  // Transform each line into a slate node
  return lines.map(line => ({
    type: 'default',
    children: [{
      text: line,
      highlight: 'none'
    }]
  }))
}