'use client'
import { ReactNode } from 'react'
import HeaderComponent from './header'
import { useMouse } from './providers'

type Props = {
  children?: React.ReactNode
  documentId?: string
}

const Layout = ({ children, documentId }: Props): ReactNode => {
  const { onMouseMove } = useMouse()
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
