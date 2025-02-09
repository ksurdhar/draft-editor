import { transformTextToSlate } from './text-to-slate'

describe('transformTextToSlate', () => {
  it('should transform plain text into slate format', () => {
    const input = `this is a sample of text

this is on another line with a newline between


two newlines before this`

    const expected = [
      {
        type: 'default',
        children: [{ text: 'this is a sample of text', highlight: 'none' }]
      },
      {
        type: 'default',
        children: [{ text: '', highlight: 'none' }]
      },
      {
        type: 'default',
        children: [{ text: 'this is on another line with a newline between', highlight: 'none' }]
      },
      {
        type: 'default',
        children: [{ text: '', highlight: 'none' }]
      },
      {
        type: 'default',
        children: [{ text: '', highlight: 'none' }]
      },
      {
        type: 'default',
        children: [{ text: 'two newlines before this', highlight: 'none' }]
      }
    ]

    const result = transformTextToSlate(input)
    expect(result).toEqual(expected)
  })

  it('should handle empty input', () => {
    const input = ''
    const expected = [{
      type: 'default',
      children: [{ text: '', highlight: 'none' }]
    }]

    const result = transformTextToSlate(input)
    expect(result).toEqual(expected)
  })
}) 