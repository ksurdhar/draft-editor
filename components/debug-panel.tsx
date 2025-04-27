'use client'
import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism' // Or choose another theme
import { XIcon, ClipboardCopyIcon, DocumentTextIcon, TerminalIcon } from '@heroicons/react/outline'
import { getDebugLogs, subscribeToLogs, getLogGroups, clearLogGroup } from '@lib/debug-logger' // Import logger functions

interface DebugPanelProps {
  content?: any // Made content optional
  onClose: () => void
  isOpen?: boolean // Add new prop for controlled open/close state
  onOpenChange?: (isOpen: boolean) => void // Add callback for state changes
}

// Updated type to accommodate dynamic log groups
type ActiveTab = 'json' | string

// LocalStorage key for panel open state
const DEBUG_PANEL_OPEN_KEY = 'debug-panel-open'
const VERTICAL_LAYOUT_KEY = 'debug-panel-vertical'
const HORIZONTAL_LAYOUT_KEY = 'debug-panel-horizontal'

const DebugPanel: React.FC<DebugPanelProps> = ({
  content,
  onClose,
  isOpen: _isOpen, // Prefix with underscore to indicate intentionally unused
  onOpenChange,
}) => {
  const [isCopied, setIsCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('general') // Default to general logs tab
  const [logs, setLogs] = useState(getDebugLogs()) // State for logs
  const [logGroups, setLogGroups] = useState<string[]>(['general']) // Track available log groups

  // State for panel position and size
  const [verticalPosition, setVerticalPosition] = useState(() => {
    try {
      const saved = localStorage.getItem(VERTICAL_LAYOUT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed[1] || 70 // Default to 70% from top if not found
      }
    } catch (e) {}
    return 70 // Default value
  })

  const [horizontalSize, setHorizontalSize] = useState(() => {
    try {
      const saved = localStorage.getItem(HORIZONTAL_LAYOUT_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        return parsed[0] || 30 // Default to 30% width if not found
      }
    } catch (e) {}
    return 30 // Default value
  })

  // Only stringify content if it exists
  const jsonString = content ? JSON.stringify(content, null, 2) : null // Pretty print the JSON

  // Function to format log entries, now filtered by group
  const formatLogs = (): string => {
    // Filter logs by selected group if not in JSON tab
    const filteredLogs = activeTab === 'json' ? logs : logs.filter(log => log.group === activeTab)

    return filteredLogs
      .map(log => {
        const time = log.timestamp.toLocaleTimeString('en-US', { hour12: false })
        const dataString = log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : ''
        return `[${time}] ${log.message}${dataString}`
      })
      .join('\n\n')
  }

  // Adjust contentToCopy based on active tab and content availability
  const contentToCopy = activeTab === 'json' ? jsonString || '' : formatLogs()

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

  // Handle panel close with persistence
  const handleClose = () => {
    // Save panel closed state to localStorage
    localStorage.setItem(DEBUG_PANEL_OPEN_KEY, 'false')

    // Notify parent component
    if (onOpenChange) {
      onOpenChange(false)
    }

    onClose()
  }

  // Handle resize events
  const handleVerticalResize = (newSize: number) => {
    setVerticalPosition(newSize)
    localStorage.setItem(VERTICAL_LAYOUT_KEY, JSON.stringify([100 - newSize, newSize]))
    localStorage.setItem(DEBUG_PANEL_OPEN_KEY, 'true')
  }

  const handleHorizontalResize = (newSize: number) => {
    setHorizontalSize(newSize)
    localStorage.setItem(HORIZONTAL_LAYOUT_KEY, JSON.stringify([newSize, 100 - newSize]))
    localStorage.setItem(DEBUG_PANEL_OPEN_KEY, 'true')
  }

  // Subscribe to log updates and track log groups
  useEffect(() => {
    const unsubscribe = subscribeToLogs(newLogs => {
      setLogs(newLogs)
      // Update available groups whenever logs change
      setLogGroups(getLogGroups())
    })

    // Initial loading of log groups
    setLogGroups(getLogGroups())

    return () => unsubscribe()
  }, [])

  // The debug panel content - extracted to be used inside the resizable panel
  const renderDebugPanelContent = () => (
    <>
      {/* Header with Tabs */}
      <div className="flex items-center justify-between border-b border-gray-700/50 bg-gray-700/50 px-4 py-1">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto">
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

          {/* Dynamic group tabs */}
          {logGroups.map(group => (
            <button
              key={group}
              onClick={() => setActiveTab(group)}
              className={`flex items-center gap-1 rounded-t px-3 py-1 text-xs transition-colors ${
                activeTab === group
                  ? 'bg-gray-800/95 text-white'
                  : 'text-gray-400 hover:bg-gray-600/30 hover:text-gray-200'
              }`}>
              <TerminalIcon className="h-3.5 w-3.5" />
              {group}
            </button>
          ))}
        </div>
        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-600/50 hover:text-white"
            title={`Copy ${activeTab === 'json' ? 'JSON' : 'Logs'}`}>
            <ClipboardCopyIcon className="h-4 w-4" />
          </button>
          {/* Clear logs button - now works with groups */}
          {activeTab !== 'json' && (
            <button
              onClick={() => {
                clearLogGroup(activeTab)
                setLogs(getDebugLogs())
              }}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-600/50 hover:text-white"
              title={`Clear ${activeTab} Logs`}>
              <XIcon className="h-3 w-3" /> {/* Smaller X for clear */}
              <span className="sr-only">Clear Logs</span>
            </button>
          )}
          <button
            onClick={handleClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-600/50 hover:text-white"
            title="Close Debug Panel">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="relative h-full overflow-auto">
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
        {/* Logs Content - Now shows for any non-JSON tab */}
        {activeTab !== 'json' && (
          <pre className="whitespace-pre-wrap break-words p-3 text-xs text-gray-300">
            {formatLogs() || `No logs available for ${activeTab}.`}
          </pre>
        )}
      </div>
    </>
  )

  // Calculate the positioning based on saved values
  const topPosition = `${verticalPosition}%`
  const width = `${horizontalSize}%`

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <motion.div
        key="debug-panel-container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="relative h-full w-full">
        {/* Actual visible debug panel with pointer events */}
        <div
          className="pointer-events-auto absolute overflow-hidden rounded-lg border border-white/10 bg-gray-800/95 shadow-xl backdrop-blur-md"
          style={{
            top: topPosition,
            left: '0',
            width: width,
            bottom: '0',
          }}>
          {renderDebugPanelContent()}
        </div>

        {/* Invisible resize handle for vertical (top) resizing */}
        <div
          className="pointer-events-auto absolute left-0 h-2 w-full cursor-ns-resize hover:bg-gray-500/20"
          style={{ top: `calc(${topPosition} - 4px)`, width: width }}
          onMouseDown={e => {
            e.preventDefault()

            const startY = e.clientY
            const startPos = verticalPosition

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaY = moveEvent.clientY - startY
              // Invert the calculation: positive deltaY (dragging down) should increase the top position value
              // negative deltaY (dragging up) should decrease the top position value
              const deltaPercent = (deltaY / window.innerHeight) * 100
              // Now directly add the delta percent
              const newPos = Math.min(Math.max(startPos + deltaPercent, 30), 90)
              handleVerticalResize(newPos)
            }

            const handleMouseUp = () => {
              window.removeEventListener('mousemove', handleMouseMove)
              window.removeEventListener('mouseup', handleMouseUp)
            }

            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
          }}
        />

        {/* Invisible resize handle for horizontal (right) resizing */}
        <div
          className="pointer-events-auto absolute top-0 w-2 cursor-ew-resize hover:bg-gray-500/20"
          style={{
            left: `calc(${width} - 2px)`,
            top: topPosition,
            bottom: '0',
          }}
          onMouseDown={e => {
            e.preventDefault()

            const startX = e.clientX
            const startWidth = horizontalSize

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const deltaX = moveEvent.clientX - startX
              const deltaPercent = (deltaX / window.innerWidth) * 100
              const newWidth = Math.min(Math.max(startWidth + deltaPercent, 20), 80)
              handleHorizontalResize(newWidth)
            }

            const handleMouseUp = () => {
              window.removeEventListener('mousemove', handleMouseMove)
              window.removeEventListener('mouseup', handleMouseUp)
            }

            window.addEventListener('mousemove', handleMouseMove)
            window.addEventListener('mouseup', handleMouseUp)
          }}
        />
      </motion.div>
    </div>
  )
}

export default DebugPanel
