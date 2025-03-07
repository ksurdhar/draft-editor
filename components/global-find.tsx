'use client'
import { ChevronDownIcon as ChevronExpandIcon } from '@heroicons/react/outline'
import { useState, useEffect, useMemo } from 'react'
import { ListItem } from './list-item'
import { useAPI } from './providers'
import { DocumentData } from '@typez/globals'
import { useNavigation } from './providers'
import { DocumentIcon } from '@heroicons/react/outline'
import { mutate } from 'swr'

interface SearchResult {
  documentId: string
  documentTitle: string
  matches: {
    text: string
    lineNumber: number
    matchIndex: number
    matchLength: number
  }[]
}

interface GlobalFindProps {
  onClose: () => void
}

interface DocumentUpdate {
  documentId: string
  content: any
  matches: {
    text: string
    lineNumber: number
    matchIndex: number
    matchLength: number
  }[]
}

export default function GlobalFind({ onClose: _onClose }: GlobalFindProps) {
  const { get, post, patch } = useAPI()
  const { navigateTo } = useNavigation()
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [searchOptions, setSearchOptions] = useState({
    matchCase: false,
    wholeWord: false
  })
  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isReplacing, setIsReplacing] = useState(false)

  // Load all documents when component mounts
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        const docs = await get('/documents')
        setDocuments(docs)
      } catch (error) {
        console.error('Error loading documents:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadDocuments()
  }, [get])

  // Search function
  const searchDocuments = useMemo(() => {
    return (term: string, options: typeof searchOptions) => {
      if (!term.trim()) {
        setSearchResults([])
        return
      }

      const results: SearchResult[] = []
      const searchRegex = options.wholeWord
        ? new RegExp(`\\b${term}\\b`, options.matchCase ? 'g' : 'gi')
        : new RegExp(term, options.matchCase ? 'g' : 'gi')

      documents.forEach(doc => {
        const matches: SearchResult['matches'] = []
        let content: string

        // Handle both string and object content
        try {
          content = typeof doc.content === 'string' 
            ? JSON.parse(doc.content).content
              .map((block: any) => block.content?.[0]?.text || '')
              .join('\n')
            : (doc.content as { content: any[] }).content
              .map((block: any) => {
                // Ensure we're getting the exact text with preserved case
                const text = block.content?.[0]?.text
                return text !== undefined ? text : ''
              })
              .join('\n')
        } catch (e) {
          console.error('Error parsing document content:', e)
          return
        }

        const lines = content.split('\n')
        lines.forEach((line, index) => {
          let match
          // Create a new regex for each exec to avoid lastIndex issues
          const regex = new RegExp(searchRegex)
          while ((match = regex.exec(line)) !== null) {
            // Get the actual text that was matched, preserving case
            const actualMatch = line.slice(match.index, match.index + match[0].length)
            matches.push({
              text: line,
              lineNumber: index + 1,
              matchIndex: match.index,
              matchLength: actualMatch.length
            })
          }
        })

        if (matches.length > 0) {
          results.push({
            documentId: doc._id,
            documentTitle: doc.title,
            matches
          })
        }
      })

      setSearchResults(results)
    }
  }, [documents])

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchDocuments(searchTerm, searchOptions)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, searchOptions, searchDocuments])

  const handleDocumentClick = (documentId: string) => {
    const currentUrl = window.location.pathname
    const baseDocumentId = currentUrl.split('/').pop()
    console.log('Global find selection:', { documentId, baseDocumentId, currentUrl })

    if (baseDocumentId) {
      const newUrl = `/documents/${baseDocumentId}?documentId=${documentId}`
      console.log('Updating URL and dispatching event:', newUrl)
      window.history.pushState({}, '', newUrl)
      // Dispatch custom event for document change
      window.dispatchEvent(new Event('documentChanged'))
    } else {
      console.log('Navigating to document:', documentId)
      navigateTo(`/documents/${documentId}`)
    }
  }

  const toggleSearchOption = (option: 'matchCase' | 'wholeWord') => {
    setSearchOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  const getTotalMatchCount = () => {
    return searchResults.reduce((total, result) => total + result.matches.length, 0)
  }

  const HighlightedText = ({ 
    text, 
    matchIndex, 
    matchLength 
  }: { 
    text: string, 
    matchIndex: number, 
    matchLength: number 
  }) => {
    const before = text.slice(0, matchIndex)
    const match = text.slice(matchIndex, matchIndex + matchLength)
    const after = text.slice(matchIndex + matchLength)

    if (replaceText && replaceText !== match) {
      return (
        <span className="normal-case">
          {before}
          <span className="bg-red-200/50 text-black/90 rounded px-0.5 line-through decoration-red-500/50">
            {match}
          </span>
          <span className="mx-1">→</span>
          <span className="bg-green-200/50 text-black/90 rounded px-0.5">
            {replaceText}
          </span>
          {after}
        </span>
      )
    }

    return (
      <span className="normal-case">
        {before}
        <span className="bg-yellow-200/50 text-black/90 rounded px-0.5">{match}</span>
        {after}
      </span>
    )
  }

  const handleReplace = async (documentUpdate: DocumentUpdate) => {
    try {
      const doc = await get(`/documents/${documentUpdate.documentId}`)
      let content = typeof doc.content === 'string' ? JSON.parse(doc.content) : doc.content
      
      // Sort matches in reverse order to not affect subsequent indices
      const sortedMatches = [...documentUpdate.matches].sort((a, b) => b.lineNumber - a.lineNumber)
      
      // Replace matches in the content
      content.content = content.content.map((block: any, blockIndex: number) => {
        const matches = sortedMatches.filter(m => m.lineNumber === blockIndex + 1)
        if (matches.length === 0) return block

        let text = block.content?.[0]?.text || ''
        matches.forEach(match => {
          text = text.slice(0, match.matchIndex) + replaceText + text.slice(match.matchIndex + match.matchLength)
        })

        return {
          ...block,
          content: [{ ...block.content[0], text }]
        }
      })

      return { documentId: documentUpdate.documentId, content }
    } catch (error) {
      console.error('Error preparing document update:', error)
      return null
    }
  }

  const handleReplaceAll = async () => {
    if (!replaceText || searchResults.length === 0) return

    setIsReplacing(true)
    try {
      const updates = await Promise.all(
        searchResults.map(result => handleReplace({
          documentId: result.documentId,
          content: null, // Will be set in handleReplace
          matches: result.matches
        }))
      )

      const validUpdates = updates.filter(Boolean)
      if (validUpdates.length === 0) {
        throw new Error('No valid updates to perform')
      }

      // Perform bulk update
      await post('/documents/bulk-update', { updates: validUpdates })

      // Update in-memory documents state
      setDocuments(prev => prev.map(doc => {
        const update = validUpdates.find(u => u?.documentId === doc._id)
        if (update) {
          return { ...doc, content: update.content }
        }
        return doc
      }))

      // Refresh documents
      await Promise.all([
        ...searchResults.map(result => mutate(`/documents/${result.documentId}`)),
        mutate('/documents')
      ])

      // Clear search results and close replace panel
      setSearchResults([])
      setShowReplace(false)
      setReplaceText('')
    } catch (error) {
      console.error('Error performing replace all:', error)
    } finally {
      setIsReplacing(false)
    }
  }

  const handleReplaceInDocument = async (documentId: string) => {
    const result = searchResults.find(r => r.documentId === documentId)
    if (!result || !replaceText) return

    setIsReplacing(true)
    try {
      const update = await handleReplace({
        documentId,
        content: null, // Will be set in handleReplace
        matches: result.matches
      })

      if (!update) {
        throw new Error('Failed to prepare document update')
      }

      // Perform single document update
      await patch(`/documents/${documentId}`, update)

      // Update in-memory documents state
      setDocuments(prev => prev.map(doc => 
        doc._id === documentId ? { ...doc, content: update.content } : doc
      ))

      // Refresh document
      await Promise.all([
        mutate(`/documents/${documentId}`),
        mutate('/documents')
      ])

      // Remove this document from search results
      setSearchResults(prev => prev.filter(r => r.documentId !== documentId))
    } catch (error) {
      console.error('Error performing replace in document:', error)
    } finally {
      setIsReplacing(false)
    }
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
          <div className="flex items-center gap-2 pl-8">
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
                  onClick={() => searchResults[0] && handleReplaceInDocument(searchResults[0].documentId)}
                  disabled={isReplacing || !replaceText || searchResults.length === 0}
                  className="text-xs px-2 py-1 rounded hover:bg-black/5 font-editor2 text-black/[.70] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Replace
                </button>
                <button
                  onClick={handleReplaceAll}
                  disabled={isReplacing || !replaceText}
                  className="text-xs px-2 py-1 rounded hover:bg-black/5 font-editor2 text-black/[.70] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  All
                </button>
              </div>
            </div>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="text-xs text-black/40 pl-2">
            {getTotalMatchCount()} matches in {searchResults.length} files
          </div>
        )}

        <div className="mt-1">
          {isLoading ? (
            <div className="text-sm text-black/50 animate-pulse">Loading documents...</div>
          ) : searchTerm.trim() === '' ? (
            <div className="text-sm text-black/50">Type to search in all documents</div>
          ) : searchResults.length === 0 ? (
            <div className="text-sm text-black/50">No results found</div>
          ) : (
            <div className="flex flex-col gap-4">
              {searchResults.map((result) => (
                <div key={result.documentId} className="flex flex-col gap-2">
                  <ListItem
                    label={result.documentTitle}
                    leftIcon={<DocumentIcon className="w-4 h-4" />}
                    onClick={() => handleDocumentClick(result.documentId)}
                    theme="dark"
                  />
                  <div className="pl-8 flex flex-col gap-1">
                    {result.matches.slice(0, 3).map((match, index) => (
                      <div 
                        key={index}
                        className="text-sm text-black/70 bg-black/[.03] rounded p-2"
                      >
                        <span className="text-black/40 mr-2">Line {match.lineNumber}:</span>
                        <HighlightedText 
                          text={match.text}
                          matchIndex={match.matchIndex}
                          matchLength={match.matchLength}
                        />
                      </div>
                    ))}
                    {result.matches.length > 3 && (
                      <div className="text-xs text-black/40 pl-2">
                        +{result.matches.length - 3} more matches
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 