'use client'
import { useState } from 'react'
import { Editor } from '@tiptap/react'
import { calculateWordCount, getTotalWordCount } from '@lib/text-utils'

interface FooterProps {
  editor: Editor | null
  initFadeIn: boolean
  fadeOut: boolean
}

const getWordCountAtPosition = (doc: any, pos: number) => {
  let text = ''
  let currentPos = 0

  doc.descendants((node: any) => {
    if (node.isText) {
      const nodeText = node.text || ''

      // If we're past the position, don't include this node
      if (currentPos >= pos) {
        return false
      }

      // If this node ends before our position, include all of it
      if (currentPos + nodeText.length <= pos) {
        text += nodeText + ' '
      } else {
        // If our position is within this node, include text up to the position
        const substring = nodeText.substring(0, pos - currentPos)
        text += substring + ' '
      }

      currentPos += nodeText.length
    }
    return true
  })

  return calculateWordCount(text)
}

const getWordCountInRange = (doc: any, from: number, to: number) => {
  let text = ''
  let currentPos = 0

  doc.descendants((node: any) => {
    if (node.isText) {
      const nodeText = node.text || ''

      // If we're past the range, don't include this node
      if (currentPos >= to) {
        return false
      }

      // If this node is before the range, skip it
      if (currentPos + nodeText.length <= from) {
        currentPos += nodeText.length
        return true
      }

      // If this node is fully within the range
      if (currentPos >= from && currentPos + nodeText.length <= to) {
        text += nodeText + ' '
      } else {
        // Node partially overlaps the range
        const start = Math.max(0, from - currentPos)
        const end = Math.min(nodeText.length, to - currentPos)
        text += nodeText.substring(start, end) + ' '
      }

      currentPos += nodeText.length
    }
    return true
  })

  return calculateWordCount(text)
}

const getCounterFormats = (editor: Editor | null) => {
  if (!editor) return ['0 words', 'page 1/1', '0%']

  const doc = editor.state.doc
  const { from, to } = editor.state.selection
  const totalWords = getTotalWordCount(doc)

  // If there's a selection range
  if (from !== to) {
    const selectedWords = getWordCountInRange(doc, from, to)
    const selectedPages = Math.ceil(selectedWords / 500)
    const totalPages = Math.ceil(totalWords / 500)
    const percentage = totalWords === 0 ? 0 : Math.round((selectedWords / totalWords) * 100)

    return [
      `${selectedWords}/${totalWords} words selected`,
      `${selectedPages}/${totalPages} pages selected`,
      `${percentage}% selected`,
    ]
  }

  // If it's just a cursor position
  const wordsAtPos = getWordCountAtPosition(doc, from)
  const posPage = Math.ceil(wordsAtPos / 500)
  const totalPages = Math.ceil(totalWords / 500)
  const percentage = totalWords === 0 ? 0 : Math.round((wordsAtPos / totalWords) * 100)

  return [`${wordsAtPos}/${totalWords} words`, `page ${posPage}/${totalPages}`, `${percentage}%`]
}

const Footer = ({ editor, initFadeIn, fadeOut }: FooterProps) => {
  const [activeFormat, setActiveFormat] = useState(0)
  const counterFormats = getCounterFormats(editor)

  return (
    <div
      className={`fixed ${initFadeIn ? 'footer-gradient' : 'bg-transparent'} ${fadeOut ? 'opacity-0' : 'opacity-100'}  bottom-0 left-0 z-10 h-[50px] w-[100vw] transition-opacity duration-700 hover:opacity-100`}>
      <div
        className="fixed bottom-0 right-0 cursor-pointer pr-[20px] font-index text-sm md:text-base"
        onClick={() => {
          if (activeFormat < 2) {
            setActiveFormat(activeFormat + 1)
          } else {
            setActiveFormat(0)
          }
        }}>
        {counterFormats[activeFormat]}
      </div>
    </div>
  )
}

export default Footer
