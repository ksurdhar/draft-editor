import Providers, { APIProvider, NavigationProvider } from '@components/providers'
import SharedDocumentPage from '@components/shared-document-page'
import { useCallback, useEffect, useState } from 'react'
import { useLocation, Route, Switch } from 'wouter'
import LandingPage from './landing-page'
import ElectronDocumentsPage from './documents-page'
import ElectronCharactersPage from './characters-page'
import ConversationsPage from '../../components/conversations/conversations-page'
import DebugPanel from '@components/debug-panel'

interface Profile {
  name: string
  email: string
}

// Network status indicator component
function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Get initial network status
    const checkInitialStatus = async () => {
      try {
        const status = await window.electronAPI.getNetworkStatus()
        setIsOnline(status)
      } catch (error) {
        console.error('Failed to get network status:', error)
      }
    }

    checkInitialStatus()

    // Set up listener for network status changes
    const removeListener = window.electronAPI.onNetworkStatusChanged(status => {
      setIsOnline(status)
    })

    return () => {
      // Clean up listener when component unmounts
      removeListener()
    }
  }, [])

  // Styles for the network indicator
  const containerStyle = {
    position: 'fixed',
    bottom: '12px',
    left: '12px',
    padding: '4px 8px',
    fontSize: '12px',
    color: isOnline ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.7)',
    zIndex: 30,
    fontFamily: 'monospace',
    transition: 'opacity 0.3s ease',
    opacity: 0.6,
  } as React.CSSProperties

  return <div style={containerStyle}>{isOnline ? 'online' : 'offline'}</div>
}

function ElectronApp() {
  const [location, setLocation] = useLocation()
  // Profile state is maintained for future use but not displayed in the current UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [profile, setProfile] = useState({} as Profile)
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(() => {
    // Initialize from localStorage if available
    const savedState = localStorage.getItem('debug-panel-open')
    return savedState === 'true'
  })

  useEffect(() => {
    const getProfile = async () => {
      const result = await window.electronAPI.getProfile()
      setProfile(result)
    }
    getProfile()
  }, [])

  // Effect to handle global keyboard shortcut for debug panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+Shift+D or Ctrl+Shift+D
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'd') {
        event.preventDefault() // Prevent default browser behavior (like bookmarking)
        setIsDebugPanelOpen(prev => {
          const newState = !prev
          // Save state to localStorage
          localStorage.setItem('debug-panel-open', String(newState))
          return newState
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Handle panel open state change
  const handleDebugPanelOpenChange = (isOpen: boolean) => {
    setIsDebugPanelOpen(isOpen)
  }

  const getLocation = useCallback(() => {
    return location
  }, [location])

  const signOut = useCallback(() => {
    window.electronAPI.logOut()
  }, [])

  return (
    <div>
      <div className="titlebar-drag-region" />
      <NavigationProvider getLocation={getLocation} navigateTo={setLocation} signOut={signOut}>
        <APIProvider
          get={window.electronAPI.get}
          destroy={window.electronAPI.destroy}
          patch={window.electronAPI.patch}
          post={window.electronAPI.post}
          delete={window.electronAPI.destroy}>
          <Providers>
            <Switch>
              <Route path="/" component={LandingPage} />
              <Route path="/documents" component={ElectronDocumentsPage} />
              <Route path="/characters" component={ElectronCharactersPage} />
              <Route path="/documents/:id" component={SharedDocumentPage} />
              <Route path="/conversations" component={ConversationsPage} />
            </Switch>
            {/* Network status indicator */}
            <NetworkStatus />
            {/* Conditionally render DebugPanel */}
            {isDebugPanelOpen && (
              <DebugPanel
                onClose={() => setIsDebugPanelOpen(false)}
                isOpen={isDebugPanelOpen}
                onOpenChange={handleDebugPanelOpenChange}
              />
            )}
          </Providers>
        </APIProvider>
      </NavigationProvider>
    </div>
  )
}

export default ElectronApp
