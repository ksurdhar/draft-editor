'use client'
import { withPageAuthRequired } from '@wrappers/auth-wrapper-client'
import ConversationsPageComponent from '../../components/conversations/conversations-page'

// Directly integrating the conversations page with authentication
const ConversationsPage = () => {
  // The shared component now has internal logic to handle both Electron and web environments
  return <ConversationsPageComponent />
}

// Export with authentication wrapper
export default withPageAuthRequired(ConversationsPage)
