import { extractDialogue } from '../utils/dialogueExtractor'

describe('extractDialogue', () => {
  it('should extract dialogue with speakers', () => {
    const text = `"Hello," said John. Mary replied, "Hi there!" "How are you?" asked John.`
    const dialogue = extractDialogue(text)
    
    expect(dialogue).toEqual([
      { text: 'Hello', speaker: 'John', index: 0 },
      { text: 'Hi there', speaker: 'Mary', index: 1 },
      { text: 'How are you', speaker: 'John', index: 2 }
    ])
  })

  it('should handle dialogue without speakers', () => {
    const text = `"Hello!" "Hi there!" "How are you?"`
    const dialogue = extractDialogue(text)
    
    expect(dialogue).toEqual([
      { text: 'Hello', speaker: undefined, index: 0 },
      { text: 'Hi there', speaker: undefined, index: 1 },
      { text: 'How are you', speaker: undefined, index: 2 }
    ])
  })

  it('should handle empty text', () => {
    const text = ''
    const dialogue = extractDialogue(text)
    
    expect(dialogue).toEqual([])
  })

  it('should handle mixed dialogue with and without speakers', () => {
    const text = `"Hello," said John. "Who's there?" "It's me," replied Mary.`
    const dialogue = extractDialogue(text)
    
    expect(dialogue).toEqual([
      { text: 'Hello', speaker: 'John', index: 0 },
      { text: "Who's there", speaker: undefined, index: 1 },
      { text: "It's me", speaker: 'Mary', index: 2 }
    ])
  })

  it('should handle different speech verbs', () => {
    const text = `"Run!" shouted John. "Why?" whispered Mary. "Danger," muttered John.`
    const dialogue = extractDialogue(text)
    
    expect(dialogue).toEqual([
      { text: 'Run', speaker: 'John', index: 0 },
      { text: 'Why', speaker: 'Mary', index: 1 },
      { text: 'Danger', speaker: 'John', index: 2 }
    ])
  })

  it('should handle reversed order (speaker before quote)', () => {
    const text = `John said "Hello." Mary whispered "Be quiet!" John muttered "Whatever."`
    const dialogue = extractDialogue(text)
    
    expect(dialogue).toEqual([
      { text: 'Hello', speaker: 'John', index: 0 },
      { text: 'Be quiet', speaker: 'Mary', index: 1 },
      { text: 'Whatever', speaker: 'John', index: 2 }
    ])
  })
}) 