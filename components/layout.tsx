import HeaderComponent from "./header"

type Props = {
  children?: React.ReactNode
}

const Layout = ({ children }: Props) => {
  return (
    <div className="h-screen w-screen">
      <div className="flex flex-col h-screen mx-40 py-10">
        { children }
      </div>
    </div>
  )
}

export default Layout