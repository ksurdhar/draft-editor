'use client'
import { XIcon } from '@heroicons/react/outline'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/solid'
import { motion } from 'framer-motion'
import { Editor } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { findAllMatches } from '../lib/search'

interface FindPanelProps {
  editor: Editor
  onClose: () => void
}

interface Match {
  from: number
  to: number
}

export default function FindPanel({ editor, onClose }: FindPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [currentMatch, setCurrentMatch] = useState(-1)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          selectPreviousMatch()
        } else {
          selectNextMatch()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Clear highlights when unmounting
  useEffect(() => {
    return () => {
      editor.commands.unsetSearchHighlight()
    }
  }, [editor])

  useEffect(() => {
    if (!searchTerm) {
      editor.commands.unsetSearchHighlight()
      setMatches([])
      setCurrentMatch(-1)
      return
    }

    const newMatches = findAllMatches(editor.state.doc, searchTerm)
    setMatches(newMatches)
    setCurrentMatch(newMatches.length > 0 ? 0 : -1)

    if (newMatches.length > 0) {
      editor.commands.setSearchHighlight(newMatches, 0)
    } else {
      editor.commands.unsetSearchHighlight()
    }
  }, [searchTerm, editor])

  const selectNextMatch = () => {
    if (matches.length === 0) return
    const nextMatch = (currentMatch + 1) % matches.length
    setCurrentMatch(nextMatch)
    editor.commands.setSearchHighlight(matches, nextMatch)
    scrollToMatch(matches[nextMatch])
  }

  const selectPreviousMatch = () => {
    if (matches.length === 0) return
    const prevMatch = (currentMatch - 1 + matches.length) % matches.length
    setCurrentMatch(prevMatch)
    editor.commands.setSearchHighlight(matches, prevMatch)
    scrollToMatch(matches[prevMatch])
  }

  const scrollToMatch = (_match: Match) => {
    const element = document.querySelector('.search-result-current')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const handleClose = () => {
    editor.commands.unsetSearchHighlight()
    onClose()
  }

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
            onClick={selectPreviousMatch}
            disabled={matches.length === 0}
            className="p-1 rounded hover:bg-black/5 disabled:opacity-30"
          >
            <ChevronUpIcon className="w-4 h-4" />
          </button>
          <button
            onClick={selectNextMatch}
            disabled={matches.length === 0}
            className="p-1 rounded hover:bg-black/5 disabled:opacity-30"
          >
            <ChevronDownIcon className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-black/5"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
} 