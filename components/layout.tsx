'use client'
import HeaderComponent from './header'
import { useMouse } from './providers'

type Props = {
  children?: React.ReactNode
  documentId?: string
}

const Layout = ({ children, documentId }: Props) => {
  const { onMouseMove } = useMouse()

  return (
    <div className="h-screen w-screen absolute font-index lowercase" onMouseMove={(e) => onMouseMove(e.clientY)}>
      <HeaderComponent documentId={documentId || ''}/>
      { children }
    </div>
  )
}

export default Layout