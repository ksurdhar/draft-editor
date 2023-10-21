import { useLocation } from 'wouter'
import { Container } from '../../components/landing-page'

const DocumentsPage = () => {
  const [_, setLocation] = useLocation()

  return (
    <Container>
      <div className='self-center text-center'>
        <a onClick={() => setLocation('/')}>You found your documents</a>
      </div>
    </Container>
  )
}

export default DocumentsPage
