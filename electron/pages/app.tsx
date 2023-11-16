import { Container } from '@components/landing-page'
import Providers, { APIProvider, NavigationProvider } from '@components/providers'
import { useGetDocs } from '@lib/hooks'
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

  const getDocs = useGetDocs()

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
        <APIProvider
          getDocs={getDocs}
          destroy={window.electronAPI.destroy}
          patch={window.electronAPI.patch}
          post={window.electronAPI.post}>
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
        </APIProvider>
      </NavigationProvider>
    </Container>
  )
}

export default App
