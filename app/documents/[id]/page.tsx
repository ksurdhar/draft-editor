import { Metadata } from 'next'
import DocumentPage from './document-page'

// Title: `whetstone - ${hybridDoc?.title}`

// replace with generateMetadata 
// https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: 'whetstone - Document',
}
 
// maybe move where we call withPageAuth
export default async function Page() {
  return <DocumentPage />
}