import Link from "next/link"
import Layout from "../../components/layout"

const ContactPage = () => {  
  return (
    <Layout>
      <h1>Contact</h1>
      <h2>
        <Link href="/">
          <a>Back to home</a>
        </Link>
      </h2>
    </Layout>
  )
}

export default ContactPage