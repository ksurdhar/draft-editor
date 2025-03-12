export const calculateWordCount = (text: string) => {
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0).length
}

export const getTotalWordCount = (doc: any) => {
  let text = ''
  doc.descendants((node: any) => {
    if (node.isText) {
      text += (node.text || '') + ' '
    }
  })
  return calculateWordCount(text)
}

// For Tiptap JSON content
export const countWordsFromContent = (content: any) => {
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content)
    } catch (e) {
      return calculateWordCount(content)
    }
  }

  let text = ''
  const traverse = (node: any) => {
    if (typeof node === 'string') {
      text += node + ' '
    } else if (node.text) {
      text += node.text + ' '
    } else if (node.content) {
      node.content.forEach(traverse)
    }
  }

  if (Array.isArray(content)) {
    content.forEach(traverse)
  } else {
    traverse(content)
  }

  return calculateWordCount(text)
}
