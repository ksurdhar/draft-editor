'use client'
import '../styles/globals.css'
import '../styles/hamburgers/hamburgers.scss'
import '../styles/loading-indicator.css'

import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { UserProvider } from '../mocks/auth-wrapper'

type mouseContextType = {
  hoveringOverMenu: boolean
  mouseMoved: boolean
  onMouseMove: (clientY: number) => void
}

const mouseContextDefaultValue: mouseContextType = {
  hoveringOverMenu: false,
  mouseMoved: false,
  onMouseMove: () => {}
}

const MouseContext = createContext<mouseContextType>(mouseContextDefaultValue)

export function useMouse() {
  return useContext(MouseContext)
}

type Props = {
  children: ReactNode
}

const useDebouncedEffect = (effect: () => void, deps: any[], delay: number) => {
  useEffect(() => {
    const handler = setTimeout(() => effect(), delay)
    return () => clearTimeout(handler)
  }, [deps, delay, effect])
}

export function MouseProvider({ children }: Props) {
  const [mouseMoved, setMouseMoved] = useState(false)
  const [hoveringOverMenu, setHoveringOverMenu] = useState(false)

  useDebouncedEffect(() => {
    setMouseMoved(false)
  }, [mouseMoved], 5000)

  
  const onMouseMove = (clientY: number) => {
    setMouseMoved(true)
    if (clientY < 45 && !hoveringOverMenu) {
      setHoveringOverMenu(true)
    } 
    if (clientY >= 45 && hoveringOverMenu) {
      setHoveringOverMenu(false)
    } 
  }

  const value = {
    mouseMoved, 
    onMouseMove,
    hoveringOverMenu
  }

  return (
    <>
      <MouseContext.Provider value={value}>
        {children}
      </MouseContext.Provider>
    </>
  )
}

function Providers({ children }: {children: ReactNode}) {
  return (
    <MouseProvider>
      <UserProvider>
        { children }
      </UserProvider>
    </MouseProvider>
  )
}

export default Providers
