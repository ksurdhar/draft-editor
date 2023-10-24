import { Titles } from '@components/landing-page'
import { useLocation } from 'wouter'

const LandingPage = () => {
  const [_, setLocation] = useLocation()

  return (
    <a onClick={() => setLocation('/documents')}>
      <Titles />
    </a>
  )
}

export default LandingPage
