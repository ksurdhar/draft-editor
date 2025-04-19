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

type Props = {
  children?: React.ReactNode
  documentId?: string
  onToggleGlobalSearch?: () => void
}

const Layout = ({ children, documentId, onToggleGlobalSearch }: Props): ReactNode => {
  const { onMouseMove, mouseMoved } = useMouse()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  // References to panel objects for manual resize control
  const mainPanelRef = useRef<any>(null)
  const chatPanelRef = useRef<any>(null)

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
        setIsChatOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggleGlobalSearch])

  // Handle chat panel open/close animation
  useEffect(() => {
    setIsAnimating(true)

    const startSize = isChatOpen ? 0 : 30
    const endSize = isChatOpen ? 30 : 0
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
            console.error('Error resizing panels:', e)
          }
        }

        currentStep++
        requestAnimationFrame(animatePanel)
      } else {
        setIsAnimating(false)
      }
    }

    requestAnimationFrame(animatePanel)

    return () => {
      // Clean up - nothing specific needed for requestAnimationFrame
    }
  }, [isChatOpen])

  const toggleChat = () => setIsChatOpen(prev => !prev)

  return (
    <div className="absolute h-screen w-screen font-geist" onMouseMove={e => onMouseMove(e.clientY)}>
      <HeaderComponent id={documentId || ''} />

      <div className="h-[calc(100vh-60px)] overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Main content */}
          <ResizablePanel ref={mainPanelRef} defaultSize={isChatOpen ? 70 : 100} minSize={30}>
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
            defaultSize={isChatOpen ? 30 : 0}
            minSize={0}
            maxSize={50}
            className={isChatOpen || isAnimating ? '' : 'hidden'}>
            <ChatPanel isOpen={isChatOpen} onClose={toggleChat} />
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
