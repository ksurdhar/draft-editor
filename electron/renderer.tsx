import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './index.css'
import App from './pages/app'

const domNode = document.getElementById('root')
if (domNode) {
  const root = createRoot(domNode)
  root.render(<App />)
}
