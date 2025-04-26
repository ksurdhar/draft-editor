'use client'
import { ReactNode, useEffect, useState, useRef } from 'react'
import HeaderComponent from './header'
import { useMouse } from './providers'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@components/ui/resizable'
import { ChatPanel } from '@components/ui/chat/chat-panel'
import { MessageSquare } from 'lucide-react'
import { Button } from '@components/ui/button'

// Direct detection method for Electron environment
// const isBrowser = typeof window !== 'undefined'
// const isElectron = isBrowser && window.hasOwnProperty('electronAPI')

// Constants for sessionStorage
const CHAT_PANEL_SIZE_KEY = 'chat-panel-size'
const DEFAULT_CHAT_SIZE = 30
const MIN_CHAT_SIZE = 20 // Minimum size for the panel when opening

type Props = {
  children?: React.ReactNode
  documentId?: string
  onToggleGlobalSearch?: () => void
}

const Layout = ({ children, documentId, onToggleGlobalSearch }: Props): ReactNode => {
  const { onMouseMove, mouseMoved } = useMouse()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isPanelVisible, setIsPanelVisible] = useState(false)
  const [chatPanelSize, setChatPanelSize] = useState(DEFAULT_CHAT_SIZE)
  const [hasInitialized, setHasInitialized] = useState(false)

  // Track if size change was from user dragging (vs. programmatic)
  const isUserResizing = useRef(false)
  // Track the last chat panel size to detect changes that aren't from toggling
  const lastChatPanelSize = useRef(DEFAULT_CHAT_SIZE)
  // Flag to prevent animation effect during user manual resizing
  const skipNextAnimation = useRef(false)
  // Flag to track if the toggle was explicitly clicked
  const wasToggleClicked = useRef(false)

  // References to panel objects for manual resize control
  const mainPanelRef = useRef<any>(null)
  const chatPanelRef = useRef<any>(null)

  // Load saved panel size from sessionStorage on initial render
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSize = sessionStorage.getItem(CHAT_PANEL_SIZE_KEY)
      if (savedSize) {
        const parsedSize = Number(savedSize)
        // Ensure we have a valid size (minimum MIN_CHAT_SIZE)
        const validSize = parsedSize > 0 ? parsedSize : DEFAULT_CHAT_SIZE
        setChatPanelSize(validSize)
        lastChatPanelSize.current = validSize
      }

      // Set initialized after first render
      setHasInitialized(true)
    }
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Shift+Command+F (Mac) or Shift+Ctrl+F (Windows) for global search
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault() // Prevent default browser behavior
        onToggleGlobalSearch?.()
      }

      // Check for Command+J (Mac) or Ctrl+J (Windows) for chat toggle
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        wasToggleClicked.current = true // Mark as explicit toggle
        setIsChatOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggleGlobalSearch, isChatOpen])

  // Update lastChatPanelSize ref when chatPanelSize changes
  useEffect(() => {
    // Only store the last size if it's a valid size (not during animation)
    if (chatPanelSize >= MIN_CHAT_SIZE && !isAnimating) {
      lastChatPanelSize.current = chatPanelSize
    }
  }, [chatPanelSize, isAnimating])

  // Handle chat panel open/close animation
  useEffect(() => {
    // Skip animations for initial page load or state syncs
    if (!hasInitialized) {
      return
    }

    // Skip animation when manually resizing
    if (skipNextAnimation.current) {
      skipNextAnimation.current = false
      return
    }

    // Skip animation if not triggered by explicit toggle
    if (!wasToggleClicked.current) {
      return
    }

    // Reset the toggle clicked flag
    wasToggleClicked.current = false

    // Immediately update visibility when opening
    if (isChatOpen) {
      setIsPanelVisible(true)
    }

    setIsAnimating(true)

    // Use a valid size for animation, defaulting to MIN_CHAT_SIZE if chatPanelSize is too small
    const effectivePanelSize = chatPanelSize < MIN_CHAT_SIZE ? MIN_CHAT_SIZE : chatPanelSize

    const startSize = isChatOpen ? 0 : effectivePanelSize
    const endSize = isChatOpen ? effectivePanelSize : 0
    const steps = 20

    let currentStep = 0

    const animatePanel = () => {
      if (currentStep <= steps) {
        const progress = currentStep / steps
        // Ease in-out function for smoother animation
        const easeProgress =
          progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2

        const currentSize = startSize + (endSize - startSize) * easeProgress

        // Use resize methods of the panel components directly
        if (mainPanelRef.current && chatPanelRef.current) {
          // Only attempt to manipulate DOM if refs are valid
          try {
            if (isChatOpen) {
              mainPanelRef.current.resize(100 - currentSize)
              chatPanelRef.current.resize(currentSize)
            } else {
              mainPanelRef.current.resize(100 - currentSize)
              chatPanelRef.current.resize(currentSize)
            }
          } catch (e) {
            // Error handling
          }
        }

        currentStep++
        requestAnimationFrame(animatePanel)
      } else {
        // Animation complete
        if (!isChatOpen) {
          // When closing, delay hiding the panel until animation is fully complete
          setTimeout(() => {
            setIsPanelVisible(false)
            setIsAnimating(false)
          }, 50) // Small delay to ensure smooth transition
        } else {
          setIsAnimating(false)

          // If we had to use the minimum size, update the actual size state
          if (chatPanelSize < MIN_CHAT_SIZE) {
            setChatPanelSize(MIN_CHAT_SIZE)
            sessionStorage.setItem(CHAT_PANEL_SIZE_KEY, MIN_CHAT_SIZE.toString())
          }
        }
      }
    }

    // Set flag to indicate this is not a user-initiated resize
    isUserResizing.current = false

    requestAnimationFrame(animatePanel)

    return () => {
      // Clean up - nothing specific needed for requestAnimationFrame
    }
  }, [isChatOpen, chatPanelSize, hasInitialized])

  const toggleChat = () => {
    // If we're about to open the chat and the size is too small, reset it
    if (!isChatOpen && chatPanelSize < MIN_CHAT_SIZE) {
      setChatPanelSize(DEFAULT_CHAT_SIZE)
    }

    // Mark as an explicit toggle action
    wasToggleClicked.current = true

    setIsChatOpen(prev => !prev)
  }

  // Save panel size when it's resized by the user
  const handlePanelResize = (sizes: number[]) => {
    // Only save the size if the chat is open and this is user-initiated
    if (sizes.length >= 2 && isChatOpen && isUserResizing.current) {
      const newChatSize = sizes[1]

      // Skip animation when manually resizing
      skipNextAnimation.current = true

      if (newChatSize >= MIN_CHAT_SIZE) {
        setChatPanelSize(newChatSize)
        sessionStorage.setItem(CHAT_PANEL_SIZE_KEY, newChatSize.toString())
      } else if (newChatSize > 0) {
        // If size is greater than 0 but less than minimum, set to minimum
        setChatPanelSize(MIN_CHAT_SIZE)
        sessionStorage.setItem(CHAT_PANEL_SIZE_KEY, MIN_CHAT_SIZE.toString())
      }
    }

    // Flag that future resize events are user-initiated (after any animation)
    if (!isAnimating) {
      isUserResizing.current = true
    }
  }

  // Calculate effective panel size for rendering, ensuring it's never zero when open
  const effectiveSize = isChatOpen
    ? chatPanelSize < MIN_CHAT_SIZE
      ? MIN_CHAT_SIZE
      : chatPanelSize
    : chatPanelSize

  // Set panel visibility without animation for initial render
  useEffect(() => {
    if (hasInitialized) {
      setIsPanelVisible(isChatOpen)
    }
  }, [isChatOpen, hasInitialized])

  return (
    <div className="absolute h-screen w-screen font-geist" onMouseMove={e => onMouseMove(e.clientY)}>
      <HeaderComponent />

      <div className="h-[calc(100vh)] overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full" onLayout={handlePanelResize}>
          {/* Main content */}
          <ResizablePanel
            ref={mainPanelRef}
            defaultSize={isChatOpen ? 100 - effectiveSize : 100}
            minSize={30}>
            <div className="h-full w-full overflow-auto">{children}</div>
          </ResizablePanel>

          {/* We always keep the handle and panel in the DOM for smooth animation */}
          <ResizableHandle
            withHandle
            className={`transition-opacity duration-300 ${
              isChatOpen || isAnimating ? 'opacity-100' : 'opacity-0'
            }`}
          />

          <ResizablePanel
            ref={chatPanelRef}
            defaultSize={isChatOpen ? effectiveSize : 0}
            minSize={0}
            maxSize={50}
            className={isPanelVisible || isAnimating ? '' : 'hidden'}>
            <ChatPanel isOpen={isChatOpen} onClose={toggleChat} documentId={documentId} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Floating chat button */}
      <Button
        onClick={toggleChat}
        variant={isChatOpen ? 'secondary' : 'outline'}
        size="icon"
        className={`fixed bottom-4 right-4 z-50 rounded-full shadow-md transition-all duration-500 ${
          mouseMoved || isChatOpen ? 'opacity-100' : 'opacity-0'
        }`}>
        <MessageSquare className={`h-5 w-5 ${isChatOpen ? 'text-primary' : ''}`} />
      </Button>
    </div>
  )
}

export default Layout
