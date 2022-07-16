import { useMouse } from '../pages/_app'
import HeaderComponent from './header'

type Props = {
  children?: React.ReactNode
}

const Layout = ({ children }: Props) => {
  const { onMouseMove } = useMouse()

  return (
    <div className="h-screen w-screen font-index uppercase" onMouseMove={(e) => onMouseMove(e.clientY)}>
      <HeaderComponent />
      { children }
    </div>
  )
}

export default Layout