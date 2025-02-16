'use client'
import SharedDocumentsPage from '@components/shared-documents-page'
import { withPageAuthRequired } from '@wrappers/auth-wrapper-client'

export const NextDocumentsPage = () => {
  return <SharedDocumentsPage />
}

export default withPageAuthRequired(NextDocumentsPage)
