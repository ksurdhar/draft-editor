import { Metadata } from 'next'
import DocumentsPage from './documents-page'

// replace with generateMetadata 
// https://nextjs.org/docs/app/building-your-application/optimizing/metadata
export const metadata: Metadata = {
  title: 'whetstone - Documents',
}
 
// maybe move where we call withPageAuth
export default async function Page() {
  return <DocumentsPage />
}