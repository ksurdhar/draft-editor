'use client'
import { XIcon, ChevronDownIcon as ChevronExpandIcon } from '@heroicons/react/outline'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/solid'
import { Editor } from '@tiptap/react'
import { useEffect, useState, useCallback } from 'react'
import { findAllMatches } from '../lib/search'

interface FindPanelProps {
  editor: Editor
  onClose: () => void
}

interface Match {
  from: number
  to: number
}

interface SearchOptions {
  matchCase: boolean
  wholeWord: boolean
}

export default function FindPanel({ editor, onClose }: FindPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [currentMatch, setCurrentMatch] = useState(-1)
  const [searchOptions, setSearchOptions] = useState<SearchOptions>({
    matchCase: false,
    wholeWord: false,
  })

  const scrollToMatch = useCallback((_match: Match) => {
    const element = document.querySelector('.search-result-current')
    if (element) {
      element.scrollIntoView({ block: 'center' })
    }
  }, [])

  const selectNextMatch = useCallback(() => {
    if (matches.length === 0) return
    const nextMatch = (currentMatch + 1) % matches.length
    setCurrentMatch(nextMatch)
    editor.commands.setSearchHighlight(matches, nextMatch)
    scrollToMatch(matches[nextMatch])
  }, [matches, currentMatch, editor, scrollToMatch])

  const selectPreviousMatch = useCallback(() => {
    if (matches.length === 0) return
    const prevMatch = (currentMatch - 1 + matches.length) % matches.length
    setCurrentMatch(prevMatch)
    editor.commands.setSearchHighlight(matches, prevMatch)
    scrollToMatch(matches[prevMatch])
  }, [matches, currentMatch, editor, scrollToMatch])

  const handleClose = useCallback(() => {
    editor.commands.unsetSearchHighlight()
    onClose()
  }, [editor, onClose])

  const handleReplace = useCallback(() => {
    if (currentMatch === -1 || !matches[currentMatch]) return

    const match = matches[currentMatch]
    editor.commands.setTextSelection({ from: match.from, to: match.to })
    editor.commands.insertContent(replaceText)
  }, [currentMatch, matches, editor, replaceText])

  // Memoize the search update function to use in multiple places
  const updateSearchResults = useCallback(() => {
    if (!searchTerm) {
      editor.commands.unsetSearchHighlight()
      setMatches([])
      setCurrentMatch(-1)
      return
    }

    const newMatches = findAllMatches(editor.state.doc, searchTerm, searchOptions)
    setMatches(newMatches)

    if (newMatches.length > 0) {
      const nextCurrentMatch = Math.min(currentMatch, newMatches.length - 1)
      setCurrentMatch(nextCurrentMatch >= 0 ? nextCurrentMatch : 0)
      editor.commands.setSearchHighlight(newMatches, nextCurrentMatch >= 0 ? nextCurrentMatch : 0)
    } else {
      setCurrentMatch(-1)
      editor.commands.unsetSearchHighlight()
    }
  }, [searchTerm, editor, currentMatch, searchOptions])

  // Listen for editor changes, including undo/redo
  useEffect(() => {
    if (!editor) return

    const handleTransaction = ({ transaction }: { transaction: any }) => {
      // Only update search if the document content changed
      if (transaction.docChanged) {
        updateSearchResults()
      }
    }

    editor.on('transaction', handleTransaction)

    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor, updateSearchResults])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter') {
        const searchInput = document.querySelector('input[placeholder="Find"]')
        const replaceInput = document.querySelector('input[placeholder="Replace with..."]')
        const isSearchFocused = document.activeElement === searchInput
        const isReplaceFocused = document.activeElement === replaceInput

        if (e.shiftKey) {
          selectPreviousMatch()
        } else if (showReplace && isReplaceFocused) {
          handleReplace()
        } else if (isSearchFocused && matches.length > 0) {
          selectNextMatch()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showReplace, matches.length, selectNextMatch, selectPreviousMatch, handleClose, handleReplace])

  // Clear highlights when unmounting
  useEffect(() => {
    return () => {
      editor.commands.unsetSearchHighlight()
    }
  }, [editor])

  // Update search results when search term changes
  useEffect(() => {
    updateSearchResults()
  }, [searchTerm, updateSearchResults])

  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0) return

    // Replace all matches from last to first to maintain position integrity
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]
      editor.commands.setTextSelection({ from: match.from, to: match.to })
      editor.commands.insertContent(replaceText)
    }
  }, [matches, editor, replaceText])

  const toggleSearchOption = useCallback((option: keyof SearchOptions) => {
    setSearchOptions(prev => ({
      ...prev,
      [option]: !prev[option],
    }))
  }, [])

  return (
    <div className="fixed right-5 top-[80px] z-50 w-[380px] rounded-lg border border-black/30 bg-white/90 backdrop-blur-md">
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="shrink-0 rounded p-1 hover:bg-black/5">
            <ChevronExpandIcon
              className={`h-4 w-4 transition-transform ${showReplace ? 'rotate-180' : ''}`}
            />
          </button>
          <div className="flex flex-1 items-center rounded bg-black/[.03] px-2">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Find"
              className="text-md w-full border-none bg-transparent py-1 font-editor2 text-black/[.70] outline-none focus:ring-0 focus:ring-offset-0"
              autoFocus
            />
            <div className="ml-1 flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => toggleSearchOption('matchCase')}
                className={`rounded p-1 hover:bg-black/5 ${searchOptions.matchCase ? 'bg-black/5' : ''}`}
                title="Match case">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <text x="4" y="17" className="text-[16px] font-bold">
                    A
                  </text>
                  <text x="12" y="17" className="text-[14px]">
                    a
                  </text>
                </svg>
              </button>
              <button
                onClick={() => toggleSearchOption('wholeWord')}
                className={`rounded p-1 hover:bg-black/5 ${searchOptions.wholeWord ? 'bg-black/5' : ''}`}
                title="Match whole word">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <text x="6" y="15" className="text-[14px]">
                    ab
                  </text>
                  <path d="M5 17h14" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
            </div>
            <span className="min-w-[40px] text-center text-xs text-black/50">
              {matches.length > 0 ? `${currentMatch + 1}/${matches.length}` : '0/0'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={selectPreviousMatch}
                disabled={matches.length === 0}
                className="rounded p-1 hover:bg-black/5 disabled:opacity-30">
                <ChevronUpIcon className="h-4 w-4" />
              </button>
              <button
                onClick={selectNextMatch}
                disabled={matches.length === 0}
                className="rounded p-1 hover:bg-black/5 disabled:opacity-30">
                <ChevronDownIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <button onClick={handleClose} className="shrink-0 rounded p-1 hover:bg-black/5">
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {showReplace && (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center rounded bg-black/[.03] px-2">
              <input
                type="text"
                value={replaceText}
                onChange={e => setReplaceText(e.target.value)}
                placeholder="Replace with..."
                className="text-md w-full border-none bg-transparent py-1 font-editor2 text-black/[.70] outline-none focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={handleReplace}
                  disabled={matches.length === 0}
                  className="rounded px-2 py-1 font-editor2 text-xs text-black/[.70] hover:bg-black/5 disabled:opacity-30">
                  Replace
                </button>
                <button
                  onClick={handleReplaceAll}
                  disabled={matches.length === 0}
                  className="rounded px-2 py-1 font-editor2 text-xs text-black/[.70] hover:bg-black/5 disabled:opacity-30">
                  All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
