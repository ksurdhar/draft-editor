import '../styles/globals.css'
import '../styles/hamburgers/hamburgers.scss'

import type { AppProps } from 'next/app'
import { UserProvider } from '@auth0/nextjs-auth0'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'


type mouseContextType = {
  mouseMoved: boolean
  onMouseMove: () => void
}

const mouseContextDefaultValue: mouseContextType = {
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

  useDebouncedEffect(() => {
    setMouseMoved(false)
  }, [mouseMoved], 5000)

  const onMouseMove = () => {
    setMouseMoved(true)
  }

  const value = {
    mouseMoved, 
    onMouseMove
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
