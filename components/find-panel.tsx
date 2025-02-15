'use client'
import { XIcon, ChevronDownIcon as ChevronExpandIcon } from '@heroicons/react/outline'
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
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [currentMatch, setCurrentMatch] = useState(-1)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter') {
        if (e.shiftKey) {
          selectPreviousMatch()
        } else if (showReplace && document.activeElement === document.querySelector('input[type="text"]:last-of-type')) {
          handleReplace()
        } else {
          selectNextMatch()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showReplace])

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

  const handleReplace = () => {
    if (currentMatch === -1 || !matches[currentMatch]) return
    
    const match = matches[currentMatch]
    editor.commands.setTextSelection({ from: match.from, to: match.to })
    editor.commands.insertContent(replaceText)
    
    // Refresh matches after replacement
    const newMatches = findAllMatches(editor.state.doc, searchTerm)
    setMatches(newMatches)
    if (newMatches.length > 0) {
      setCurrentMatch(Math.min(currentMatch, newMatches.length - 1))
      editor.commands.setSearchHighlight(newMatches, currentMatch)
    } else {
      setCurrentMatch(-1)
      editor.commands.unsetSearchHighlight()
    }
  }

  const handleReplaceAll = () => {
    if (matches.length === 0) return

    // Replace all matches from last to first to maintain position integrity
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]
      editor.commands.setTextSelection({ from: match.from, to: match.to })
      editor.commands.insertContent(replaceText)
    }

    // Clear matches after replacing all
    setMatches([])
    setCurrentMatch(-1)
    editor.commands.unsetSearchHighlight()
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="fixed right-5 top-[80px] z-50 w-[300px] rounded-lg bg-white/90 backdrop-blur-md shadow-lg border border-black/10"
    >
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="p-1 rounded hover:bg-black/5"
          >
            <ChevronExpandIcon className={`w-4 h-4 transition-transform ${showReplace ? 'rotate-180' : ''}`} />
          </button>
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

        {showReplace && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 pl-8"
          >
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              className="flex-1 bg-transparent border-none outline-none text-sm"
            />
            <button
              onClick={handleReplace}
              disabled={matches.length === 0}
              className="text-xs px-2 py-1 rounded hover:bg-black/5 disabled:opacity-30"
            >
              Replace
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matches.length === 0}
              className="text-xs px-2 py-1 rounded hover:bg-black/5 disabled:opacity-30"
            >
              All
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
} 