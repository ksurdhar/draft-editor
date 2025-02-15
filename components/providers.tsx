'use client'
import '@styles/globals.css'
import '@styles/hamburgers/hamburgers.scss'
import '@styles/loading-indicator.css'
import { DocumentData } from '@typez/globals'

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
  signOut: () => void
  clearTreeState: () => void
}

const navContextDefaultValue: navContextType = {
  navigateTo: () => {},
  getLocation: () => '',
  signOut: () => {},
  clearTreeState: () => {},
}

const NavigationContext = createContext<navContextType>(navContextDefaultValue)

export type ApiResponse<T = any> = Promise<T>

type apiContextType = {
  post: (path: string, body: any) => ApiResponse
  patch: (path: string, body: any) => ApiResponse
  destroy: (path: string) => void
  get: (path: string) => ApiResponse
}

const apiContextDefaultValue: apiContextType = {
  post: async () => ({ data: {} }),
  patch: async () => ({ data: {} }),
  destroy: async () => {},
  get: async () => ({ data: {} }),
}

const APIContext = createContext<apiContextType>(apiContextDefaultValue)

export function useAPI() {
  return useContext(APIContext)
}

type DocumentContextType = {
  getDocument: (id: string) => Promise<DocumentData>
}

const documentContextDefaultValue: DocumentContextType = {
  getDocument: async () => ({}) as DocumentData,
}

const DocumentContext = createContext<DocumentContextType>(documentContextDefaultValue)

export function useDocument() {
  return useContext(DocumentContext)
}

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

export function DocumentProvider({
  children,
  getDocument,
}: DocumentContextType & {
  children: React.ReactNode
}) {
  const value = { getDocument }

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>
}

export function APIProvider({
  children,
  post,
  patch,
  destroy,
  get,
}: apiContextType & {
  children: React.ReactNode
}) {
  const value = { post, patch, destroy, get }
  return <APIContext.Provider value={value}>{children}</APIContext.Provider>
}

export function NavigationProvider({
  children,
  navigateTo,
  getLocation,
  signOut,
}: {
  children: ReactNode
  navigateTo: (path: string) => void
  getLocation: () => string
  signOut: () => void
}) {
  const clearTreeState = () => {
    try {
      localStorage.removeItem('editor-tree-expanded')
    } catch (e) {
      console.error('Error clearing tree state:', e)
    }
  }

  const value = { 
    navigateTo: (path: string) => {
      // Clear tree state when navigating to documents list
      if (path === '/documents') {
        clearTreeState()
      }
      navigateTo(path)
    }, 
    getLocation, 
    signOut,
    clearTreeState
  }

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
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
