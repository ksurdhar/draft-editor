'use client'
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism' // Or choose another theme
import { XIcon, ClipboardCopyIcon, DocumentTextIcon, TerminalIcon } from '@heroicons/react/outline'
import { getDebugLogs, clearDebugLogs, subscribeToLogs } from '@lib/debug-logger' // Import logger functions

interface DebugPanelProps {
  content?: any // Made content optional
  onClose: () => void
}

type ActiveTab = 'json' | 'logs'

const DebugPanel: React.FC<DebugPanelProps> = ({ content, onClose }) => {
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('logs') // Default to logs tab
  const [logs, setLogs] = useState(getDebugLogs()) // State for logs

  // Only stringify content if it exists
  const jsonString = content ? JSON.stringify(content, null, 2) : null // Pretty print the JSON

  // Function to format log entries
  const formatLogs = (): string => {
    return logs
      .map(log => {
        const time = log.timestamp.toLocaleTimeString('en-US', { hour12: false })
        const dataString = log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : ''
        return `[${time}] ${log.message}${dataString}`
      })
      .join('\n\n')
  }

  // Adjust contentToCopy based on active tab and content availability
  const contentToCopy = activeTab === 'logs' ? formatLogs() : jsonString || ''

  // Function to handle copying to clipboard
  const handleCopy = () => {
    navigator.clipboard
      .writeText(contentToCopy)
      .then(() => {
        setIsCopied(true)
        // Reset the copied state after a short delay
        setTimeout(() => setIsCopied(false), 1500)
      })
      .catch(err => {
        console.error('Failed to copy text: ', err)
        // Optionally show an error message to the user
      })
  }

  // Subscribe to log updates
  useEffect(() => {
    // Only subscribe when the logs tab is active
    if (activeTab === 'logs') {
      const unsubscribe = subscribeToLogs(setLogs)
      return () => unsubscribe()
    }
  }, [activeTab])

  return (
    <motion.div
      key="debug-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed bottom-4 left-4 z-[100] h-[40vh] w-[calc(100vw-32px)] max-w-xl overflow-hidden rounded-lg border border-white/10 bg-gray-800/95 shadow-xl backdrop-blur-md lg:w-auto lg:max-w-2xl"
      // Add drag functionality if desired
      // drag
      // dragConstraints={{ left: 0, right: 0, top: -200, bottom: 0 }} // Example constraints
    >
      {/* Header with Tabs */}
      <div className="flex items-center justify-between border-b border-gray-700/50 bg-gray-700/50 px-4 py-1">
        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-1 rounded-t px-3 py-1 text-xs transition-colors ${
              activeTab === 'json'
                ? 'bg-gray-800/95 text-white'
                : 'text-gray-400 hover:bg-gray-600/30 hover:text-gray-200'
            }`}>
            <DocumentTextIcon className="h-3.5 w-3.5" />
            JSON
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1 rounded-t px-3 py-1 text-xs transition-colors ${
              activeTab === 'logs'
                ? 'bg-gray-800/95 text-white'
                : 'text-gray-400 hover:bg-gray-600/30 hover:text-gray-200'
            }`}>
            <TerminalIcon className="h-3.5 w-3.5" />
            Logs
          </button>
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-600/50 hover:text-white"
            title={`Copy ${activeTab === 'json' ? 'JSON' : 'Logs'}`}>
            <ClipboardCopyIcon className="h-4 w-4" />
          </button>
          {/* Optionally add a clear logs button */}
          {activeTab === 'logs' && (
            <button
              onClick={() => {
                clearDebugLogs()
                setLogs([])
              }}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-600/50 hover:text-white"
              title="Clear Logs">
              <XIcon className="h-3 w-3" /> {/* Smaller X for clear */}
              <span className="sr-only">Clear Logs</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-600/50 hover:text-white"
            title="Close Debug Panel">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="relative h-[calc(40vh-33px)] overflow-auto">
        {/* Show "Copied!" feedback */}
        {isCopied && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute right-2 top-2 z-10 rounded bg-green-500/80 px-2 py-0.5 text-xs font-medium text-white">
            Copied!
          </motion.div>
        )}
        {/* JSON Content */}
        {activeTab === 'json' &&
          (jsonString ? (
            <SyntaxHighlighter
              language="json"
              style={vscDarkPlus} // Apply the chosen theme
              customStyle={{ margin: 0, height: '100%', width: '100%', fontSize: '11px' }} // Ensure width is 100%
              wrapLines={true}
              showLineNumbers={true} // Optional: show line numbers
            >
              {jsonString}
            </SyntaxHighlighter>
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-sm text-gray-400">
              No document JSON available in this view.
            </div>
          ))}
        {/* Logs Content */}
        {activeTab === 'logs' && (
          <pre className="whitespace-pre-wrap break-words p-3 text-xs text-gray-300">
            {formatLogs() || 'No debug logs yet.'}
          </pre>
        )}
      </div>
    </motion.div>
  )
}

export default DebugPanel
