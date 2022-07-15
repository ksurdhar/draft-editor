import { useEffect, useState } from 'react'
import HeaderComponent from './header'

type Props = {
  children?: React.ReactNode
}

const useDebouncedEffect = (effect: () => void, deps: any[], delay: number) => {
  useEffect(() => {
    const handler = setTimeout(() => effect(), delay)

    return () => clearTimeout(handler)
  }, [...deps || [], delay])
}

const Layout = ({ children }: Props) => {
  const [mouseMoved, setMouseMoved] = useState(false)

  useDebouncedEffect(() => {
    setMouseMoved(false)
  }, [mouseMoved], 5000)

  return (
    <div className="h-screen w-screen font-index uppercase" onMouseMove={() => {
      setMouseMoved(true)
    }}>
      <HeaderComponent isMouseStill={!mouseMoved} />
      {/* 64px is the header height */}
      { children }
    </div>
  )
}

export default Layout