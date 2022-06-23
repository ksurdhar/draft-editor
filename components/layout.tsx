import HeaderComponent from "./header"

type Props = {
  children?: React.ReactNode
}

const Layout = ({ children }: Props) => {
  return (
    <div>
      <HeaderComponent />
      <div className="">
        { children }
      </div>
    </div>
  )
}

export default Layout