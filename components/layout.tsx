import HeaderComponent from './header'

type Props = {
  children?: React.ReactNode
}

const Layout = ({ children }: Props) => {
  return (
    <div className="h-screen w-screen">
      <HeaderComponent/>
      {/* 64px is the header height */}
      <div className="flex flex-col h-[calc(100vh_-_64px)] mx-40 pb-10">
        { children }
      </div>
    </div>
  )
}

export default Layout