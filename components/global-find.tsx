'use client'
import { XIcon, ChevronDownIcon as ChevronExpandIcon } from '@heroicons/react/outline'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { ListItem } from './list-item'

interface GlobalFindProps {
  onClose: () => void
}

export default function GlobalFind({ onClose }: GlobalFindProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [searchOptions, setSearchOptions] = useState({
    matchCase: false,
    wholeWord: false
  })

  const toggleSearchOption = (option: 'matchCase' | 'wholeWord') => {
    setSearchOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  return (
    <div className="h-[calc(100vh_-_44px)] p-4 overflow-y-auto">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="p-1 rounded hover:bg-black/5 shrink-0"
          >
            <ChevronExpandIcon className={`w-4 h-4 transition-transform ${showReplace ? 'rotate-180' : ''}`} />
          </button>
          <div className="flex-1 bg-black/[.03] rounded px-2 flex items-center">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Find in all documents"
              className="w-full py-1 bg-transparent border-none outline-none text-md font-editor2 text-black/[.70] focus:ring-0 focus:ring-offset-0"
              autoFocus
            />
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              <button
                onClick={() => toggleSearchOption('matchCase')}
                className={`p-1 rounded hover:bg-black/5 ${searchOptions.matchCase ? 'bg-black/5' : ''}`}
                title="Match case"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <text x="4" y="17" className="text-[16px] font-bold">A</text>
                  <text x="12" y="17" className="text-[14px]">a</text>
                </svg>
              </button>
              <button
                onClick={() => toggleSearchOption('wholeWord')}
                className={`p-1 rounded hover:bg-black/5 ${searchOptions.wholeWord ? 'bg-black/5' : ''}`}
                title="Match whole word"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <text x="6" y="15" className="text-[14px]">ab</text>
                  <path d="M5 17h14" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {showReplace && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 pl-8"
          >
            <div className="flex-1 bg-black/[.03] rounded px-2 flex items-center">
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace with..."
                className="w-full py-1 bg-transparent border-none outline-none text-md font-editor2 text-black/[.70] focus:ring-0 focus:ring-offset-0"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {}}
                  className="text-xs px-2 py-1 rounded hover:bg-black/5 font-editor2 text-black/[.70]"
                >
                  Replace
                </button>
                <button
                  onClick={() => {}}
                  className="text-xs px-2 py-1 rounded hover:bg-black/5 font-editor2 text-black/[.70]"
                >
                  All
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-4">
          {/* Search results will go here */}
          <div className="text-sm text-black/50">No results yet</div>
        </div>
      </div>
    </div>
  )
} 