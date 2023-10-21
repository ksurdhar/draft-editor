import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './index.css'
import LandingPage from './pages/landing-page'

const domNode = document.getElementById('root')
if (domNode) {
  const root = createRoot(domNode)
  root.render(<LandingPage />)
}
