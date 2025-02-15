'use client'
import { ReactNode, useEffect } from 'react'
import HeaderComponent from './header'
import { useMouse } from './providers'

type Props = {
  children?: React.ReactNode
  documentId?: string
  onToggleGlobalSearch?: () => void
}

const Layout = ({ children, documentId, onToggleGlobalSearch }: Props): ReactNode => {
  const { onMouseMove } = useMouse()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Shift+Command+F (Mac) or Shift+Ctrl+F (Windows)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault() // Prevent default browser behavior
        onToggleGlobalSearch?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggleGlobalSearch])

  return (
    <div
      className="absolute h-screen w-screen font-index lowercase"
      onMouseMove={e => onMouseMove(e.clientY)}>
      <HeaderComponent id={documentId || ''} />
      {children}
    </div>
  )
}

export default Layout
