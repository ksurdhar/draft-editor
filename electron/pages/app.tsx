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

function ElectronApp() {
  const [location, setLocation] = useLocation()
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
          </Providers>
        </APIProvider>
      </NavigationProvider>
    </div>
  )
}

export default ElectronApp
