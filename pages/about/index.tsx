import Link from "next/link"
import Layout from "../../components/Layout"

const AboutPage = () => {  
  return (
    <Layout>
      <h1>About</h1>
      <h2>
        <Link href="/">
          <a>Back to home</a>
        </Link>
      </h2>
    </Layout>
  )
}

export default AboutPage