import HeaderComponent from './header'

type Props = {
  children?: React.ReactNode
}

// bg-[#fffaf4] <-- off white color

// instead of importing this everywhere, it can be pulled into _app.tsx to be reused 
// see: https://nextjs.org/docs/basic-features/layouts for details
const Layout = ({ children }: Props) => {
  return (
    <div className="h-screen w-screen">
      <div className='gradient fixed h-screen w-screen z-[-1]'/>
      <HeaderComponent/>
      {/* 64px is the header height */}
      { children }
    </div>
  )
}

export default Layout