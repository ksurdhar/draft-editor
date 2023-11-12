import { Container } from '@components/landing-page'
import Providers, { NavigationProvider } from '@components/providers'
import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import DocumentsPage from './electron-documents-page'
import LandingPage from './landing-page'

interface Profile {
  name: string
  email: string
}

function App() {
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

  return (
    <Container>
      <NavigationProvider getLocation={getLocation} navigateTo={setLocation}>
        <Providers>
          <div className="flex-col self-center">
            <button onClick={() => window.electronAPI.logOut()}>logout</button>
            <div className="flex flex-col">
              <div>{profile?.name}</div>
            </div>
          </div>
          {location === '/' && <LandingPage />}
          {location === '/documents' && <DocumentsPage />}
        </Providers>
      </NavigationProvider>
    </Container>
  )
}

export default App
