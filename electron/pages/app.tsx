import Providers, { APIProvider, NavigationProvider } from '@components/providers'
import SharedDocumentPage from '@components/shared-document-page'
import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import LandingPage from './landing-page'
import ElectronDocumentsPage from './documents-page'

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

  useEffect(() => {
    const getProfile = async () => {
      const result = await window.electronAPI.getProfile()
      setProfile(result)
    }
    getProfile()
  }, [])

  const getLocation = useCallback(() => {
    return location
  }, [location])

  const isDocumentLocation = useCallback(() => {
    const regex = /^\/documents\/([^\/]+)$/
    return regex.test(location)
  }, [location])

  const signOut = useCallback(() => {
    window.electronAPI.logOut()
  }, [])

  return (
    <div>
      <NavigationProvider getLocation={getLocation} navigateTo={setLocation} signOut={signOut}>
        <APIProvider
          get={window.electronAPI.get}
          destroy={window.electronAPI.destroy}
          patch={window.electronAPI.patch}
          post={window.electronAPI.post}
          delete={window.electronAPI.destroy}>
          <Providers>
            {location === '/' && <LandingPage />}
            {location === '/documents' && <ElectronDocumentsPage />}
            {isDocumentLocation() && <SharedDocumentPage />}
            {/* Network status indicator */}
            <NetworkStatus />
          </Providers>
        </APIProvider>
      </NavigationProvider>
    </div>
  )
}

export default ElectronApp
