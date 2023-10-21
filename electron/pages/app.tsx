import { useLocation } from 'wouter'
import DocumentsPage from './documents-page'
import LandingPage from './landing-page'

function App() {
  const [location] = useLocation()
  return (
    <>
      { location === '/' && <LandingPage/>}
      { location === '/documents' && <DocumentsPage/>}
    </>
  )
}

export default App