import nlp from 'compromise'

interface DialogueEntry {
  text: string
  speaker?: string
  index: number
}

export function extractDialogue(text: string): DialogueEntry[] {
  const dialogue: DialogueEntry[] = []
  const positions: { text: string; pos: number; speaker?: string }[] = []

  // Match patterns like:
  // 1. "Hello," said John
  // 2. John said "Hello"
  const patterns = [
    /"([^"]+)"\s*(?:,\s*)?(?:said|asked|replied|shouted|whispered|muttered)\s+(\w+)/gi,
    /(\w+)\s+(?:said|asked|replied|shouted|whispered|muttered)(?:\s*,\s*)?\s*"([^"]+)"/gi,
  ]

  // Process each pattern
  patterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(text)) !== null) {
      // For pattern 1: groups[1] = quote, groups[2] = speaker
      // For pattern 2: groups[1] = speaker, groups[2] = quote
      const [_, g1, g2] = match
      const isPatternOne = match[0].startsWith('"')
      const quote = (isPatternOne ? g1 : g2).trim().replace(/[,.!?]\s*$/, '')
      const speaker = isPatternOne ? g2 : g1

      positions.push({
        text: quote,
        speaker,
        pos: text.indexOf(quote),
      })
    }
  })

  // Also capture quotes without explicit speakers
  const quotePattern = /"([^"]+)"/g
  let match
  while ((match = quotePattern.exec(text)) !== null) {
    const quote = match[1].trim().replace(/[,.!?]\s*$/, '')
    // Skip if this quote was already captured with a speaker
    if (!positions.some(p => p.text === quote)) {
      positions.push({
        text: quote,
        pos: match.index + 1, // +1 to account for the opening quote
      })
    }
  }

  // Sort by position in text and create final dialogue entries
  return positions
    .sort((a, b) => a.pos - b.pos)
    .map((pos, index) => ({
      text: pos.text,
      speaker: pos.speaker,
      index,
    }))
}

// Example usage:
// const text = `"Hello," said John. Mary replied, "Hi there!" "How are you?" asked John.`
// const dialogue = extractDialogue(text)
// console.log(dialogue)
// Output:
// [
//   { text: 'Hello', speaker: 'John', index: 0 },
//   { text: 'Hi there', speaker: 'Mary', index: 1 },
//   { text: 'How are you', speaker: 'John', index: 2 }
// ]
