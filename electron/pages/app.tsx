import { Container } from '@components/landing-page'
import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import DocumentsPage from './documents-page'
import LandingPage from './landing-page'

interface Profile {
  name: string
  email: string
}

function App() {
  const [location] = useLocation()
  const [profile, setProfile] = useState({} as Profile)

  useEffect(() => {
    const fetchDocuments = async () => {
      const result = await window.electronAPI.getProfile()
      setProfile(result)
    }
    fetchDocuments()
  }, [])

  return (
    <Container>
      <div className="flex-col self-center">
        <button onClick={() => window.electronAPI.logOut()}>logout</button>
        <div className="flex flex-col">
          <div>{profile?.name}</div>
        </div>
      </div>
      {location === '/' && <LandingPage />}
      {location === '/documents' && <DocumentsPage />}
    </Container>
  )
}

export default App
