import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/globals.css'
import './index.css'
import LandingPage from './landing-page'

const domNode = document.getElementById('root')
if (domNode) {
  const root = createRoot(domNode)
  root.render(<LandingPage />)
}

console.log('React version', React.version)
