'use client'
import '@styles/globals.css'
import '@styles/hamburgers/hamburgers.scss'
import '@styles/loading-indicator.css'

import { UserProvider } from '@wrappers/auth-wrapper-client'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

type mouseContextType = {
  hoveringOverMenu: boolean
  mouseMoved: boolean
  onMouseMove: (clientY: number) => void
}

const mouseContextDefaultValue: mouseContextType = {
  hoveringOverMenu: false,
  mouseMoved: false,
  onMouseMove: () => {},
}

const MouseContext = createContext<mouseContextType>(mouseContextDefaultValue)

type navContextType = {
  navigateTo: (path: string) => void
  getLocation: () => string
}

const navContextDefaultValue: navContextType = {
  navigateTo: () => {},
  getLocation: () => '',
}

const NavigationContext = createContext<navContextType>(navContextDefaultValue)

export function useNavigation() {
  return useContext(NavigationContext)
}

export function useMouse() {
  return useContext(MouseContext)
}

const useDebouncedEffect = (effect: () => void, deps: any[], delay: number) => {
  useEffect(() => {
    const handler = setTimeout(() => effect(), delay)
    return () => clearTimeout(handler)
  }, [deps, delay, effect])
}

export function NavigationProvider({
  children,
  navigateTo,
  getLocation,
}: {
  children: ReactNode
  navigateTo: (path: string) => void
  getLocation: () => string
}) {
  const value = { navigateTo, getLocation }

  return (
    <>
      <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
    </>
  )
}

export function MouseProvider({ children }: { children: ReactNode }) {
  const [mouseMoved, setMouseMoved] = useState(false)
  const [hoveringOverMenu, setHoveringOverMenu] = useState(false)

  useDebouncedEffect(
    () => {
      setMouseMoved(false)
    },
    [mouseMoved],
    5000,
  )

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
    hoveringOverMenu,
  }

  return (
    <>
      <MouseContext.Provider value={value}>{children}</MouseContext.Provider>
    </>
  )
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <MouseProvider>
      <UserProvider>{children}</UserProvider>
    </MouseProvider>
  )
}

export default Providers
