import '../styles/globals.css'
import '../styles/hamburgers/hamburgers.scss'

import type { AppProps } from 'next/app'
import { UserProvider } from '@auth0/nextjs-auth0'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'


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
  }, [...deps || [], delay])
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

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <MouseProvider>
      <UserProvider>
        <Component {...pageProps} />
      </UserProvider>
    </MouseProvider>
  )
}

export default MyApp
