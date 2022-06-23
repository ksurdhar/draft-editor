type Props = {
  children?: React.ReactNode
}

const Layout = ({ children }: Props) => {
  return (
    <div className="m-2">
      { children }
    </div>
  )
}

export default Layout