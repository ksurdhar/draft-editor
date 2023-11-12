import { useLocation } from 'wouter'

interface LinkProps {
  href: string
  children: React.ReactNode
}

const NextLink = ({ href, children }: LinkProps) => {
  const [_, setLocation] = useLocation()

  return <a onClick={() => setLocation(href)}>{children}</a>
}

export default NextLink
