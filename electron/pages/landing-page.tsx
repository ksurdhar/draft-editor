import { Container, Titles } from '@components/landing-page'
import { useLocation } from 'wouter'

const LandingPage = () => {
  const [_, setLocation] = useLocation()

  return (
    <Container>
      <a onClick={() => setLocation('/documents')}>
        <Titles />
      </a>
    </Container>
  )
}

export default LandingPage
