'use client'
import { XIcon } from '@heroicons/react/outline'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/solid'
import { motion } from 'framer-motion'
import { Editor, Text } from 'slate'
import { ReactEditor } from 'slate-react'
import { WhetstoneEditor } from '@typez/globals'
import { useEffect, useState } from 'react'
import { FindDecoration } from '@lib/slate-plugins/decorations'

type FindPanelProps = {
  editor: WhetstoneEditor
  onClose: () => void
}

type Match = {
  path: number[]
  range: {
    anchor: { path: number[], offset: number }
    focus: { path: number[], offset: number }
    color: 'blue' | 'pending'
  }
}

const FindPanel = ({ editor, onClose }: FindPanelProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [currentMatch, setCurrentMatch] = useState(0)

  const findMatches = (term: string) => {
    console.log('=== Starting search for:', term, '===')
    if (!term) {
      setMatches([])
      editor.setDecorations([])
      console.log('=== Search ended: empty term ===')
      return
    }

    const foundMatches: Match[] = []
    for (const [node, path] of Editor.nodes(editor, {
      at: [],
      match: n => Text.isText(n) && n.text.toLowerCase().includes(term.toLowerCase()),
    })) {
      if (Text.isText(node)) {
        const textContent = node.text
        let lastIndex = 0
        while (lastIndex !== -1) {
          const index = textContent.toLowerCase().indexOf(term.toLowerCase(), lastIndex)
          if (index === -1) break
          
          // Create a range that only covers the exact match
          const range = {
            anchor: { path, offset: index },
            focus: { path, offset: index + term.length },
            color: 'pending' as const
          }
          foundMatches.push({ path, range })
          // Move past this match to find the next one
          lastIndex = index + term.length
        }
      }
    }

    // Update decorations for all matches
    const decorations: FindDecoration[] = foundMatches.map((match, index) => ({
      anchor: match.range.anchor,
      focus: match.range.focus,
      color: index === currentMatch ? 'blue' : 'pending'
    }))
    editor.setDecorations(decorations)
    console.log('=== Search ended:', foundMatches.length, 'matches found ===')

    setMatches(foundMatches)
    setCurrentMatch(foundMatches.length > 0 ? 0 : -1)
  }

  const handleNext = () => {
    if (matches.length === 0) return
    const nextMatch = (currentMatch + 1) % matches.length
    setCurrentMatch(nextMatch)
    selectAndScrollToMatch(matches[nextMatch])
  }

  const handlePrevious = () => {
    if (matches.length === 0) return
    const prevMatch = (currentMatch - 1 + matches.length) % matches.length
    setCurrentMatch(prevMatch)
    selectAndScrollToMatch(matches[prevMatch])
  }

  const selectAndScrollToMatch = (match: Match) => {
    try {
      ReactEditor.focus(editor)
      const domRange = ReactEditor.toDOMRange(editor, match.range)
      const domSelection = window.getSelection()
      if (domSelection) {
        domSelection.removeAllRanges()
        domSelection.addRange(domRange)
      }
      domRange.startContainer.parentElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center'
      })

      // Update decorations to highlight current match differently
      const decorations: FindDecoration[] = matches.map((m, index) => ({
        anchor: m.range.anchor,
        focus: m.range.focus,
        color: index === currentMatch ? 'blue' : 'pending'
      }))
      editor.setDecorations(decorations)
    } catch (err) {
      console.error('Error setting selection:', err)
    }
  }

  useEffect(() => {
    findMatches(searchTerm)
    return () => {
      editor.setDecorations([])
    }
  }, [searchTerm])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-5 top-[80px] z-50 w-[300px] rounded-lg bg-white/90 backdrop-blur-md shadow-lg border border-black/10"
    >
      <div className="p-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Find in document..."
            className="flex-1 bg-transparent border-none outline-none text-sm"
            autoFocus
          />
          <span className="text-xs text-black/50">
            {matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : '0/0'}
          </span>
          <button
            onClick={handlePrevious}
            disabled={matches.length === 0}
            className="p-1 rounded hover:bg-black/5 disabled:opacity-30"
          >
            <ChevronUpIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={matches.length === 0}
            className="p-1 rounded hover:bg-black/5 disabled:opacity-30"
          >
            <ChevronDownIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black/5"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default FindPanel 