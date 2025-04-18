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
    bottom: '20px',
    right: '20px',
    padding: '8px 12px',
    borderRadius: '4px',
    backgroundColor: isOnline ? 'rgba(0, 128, 0, 0.1)' : 'rgba(255, 0, 0, 0.1)',
    border: `1px solid ${isOnline ? 'green' : 'red'}`,
    color: isOnline ? 'green' : 'red',
    fontSize: '14px',
    fontWeight: 'bold',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'all 0.3s ease',
  } as React.CSSProperties

  const indicatorStyle = {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: isOnline ? 'green' : 'red',
    boxShadow: `0 0 4px ${isOnline ? 'green' : 'red'}`,
  }

  return (
    <div style={containerStyle}>
      <div style={indicatorStyle}></div>
      {isOnline ? 'Online' : 'Offline'}
    </div>
  )
}

function ElectronApp() {
  const [location, setLocation] = useLocation()
  // Profile state is maintained for future use but not displayed in the current UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [profile, setProfile] = useState({} as Profile)
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false)

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
        setIsDebugPanelOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

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
            {isDebugPanelOpen && <DebugPanel onClose={() => setIsDebugPanelOpen(false)} />}
          </Providers>
        </APIProvider>
      </NavigationProvider>
    </div>
  )
}

export default ElectronApp
