import { Container, Titles } from 'components/landing-page'
import type { Metadata, NextPage } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'whetstone',
}

const Home: NextPage = () => {
  return (
    <Container>
      <Link href="/documents">
        <Titles />
      </Link>
    </Container>
  )
}

export default Home
