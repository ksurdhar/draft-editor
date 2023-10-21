import { useLocation } from 'wouter'
import { Container, Titles } from '../../components/landing-page'

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
