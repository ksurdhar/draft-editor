import {
  ComponentType,
  FC,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

interface UserProfile {
  email?: string | null
  email_verified?: boolean | null
  name?: string | null
  nickname?: string | null
  picture?: string | null
  sub?: string | null
  updated_at?: string | null
  org_id?: string | null
  [key: string]: unknown // Any custom claim which could be in the profile
}

export type UserContext = {
  user?: UserProfile
  error?: Error
  isLoading: boolean
}

const defaultUserContext: UserContext = {
  user: undefined,
  error: undefined,
  isLoading: true,
}

const ElectronUserContext = createContext<UserContext>(defaultUserContext)

type Props = {
  children: ReactNode
}
export const UserProvider: FC<Props> = ({ children }) => {
  const [userContext, setUserContext] = useState<UserContext>(defaultUserContext)

  const checkSession = useCallback(async () => {
    setUserContext(prev => ({ ...prev, isLoading: true }))
    try {
      const userProfile = await window.electronAPI.getProfile()
      setUserContext({ user: userProfile, error: undefined, isLoading: false })
    } catch (error) {
      setUserContext({ user: undefined, error: error as Error, isLoading: false })
    }
  }, [])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return <ElectronUserContext.Provider value={userContext}>{children}</ElectronUserContext.Provider>
}

export { ElectronUserContext as UserContext }

export const useUser = () => {
  return useContext(ElectronUserContext)
}

// Below is not actually in use by electron

export interface WithPageAuthRequiredOptions {
  returnTo?: string
  onRedirecting?: () => JSX.Element
  onError?: (error: Error) => JSX.Element
}

export interface UserProps {
  user: UserProfile
}

export type WithPageAuthRequired = <P extends {}>(
  Component: ComponentType<P & UserProps>,
  options?: WithPageAuthRequiredOptions,
) => React.FC<P>

const defaultOnRedirecting = (): JSX.Element => <></>

const defaultOnError = (): JSX.Element => <></>

export const withPageAuthRequired: WithPageAuthRequired = (Component, options = {}) => {
  return function WithPageAuthRequired(props): JSX.Element {
    const { returnTo, onRedirecting = defaultOnRedirecting, onError = defaultOnError } = options
    const { user, error, isLoading } = useUser()

    useEffect(() => {
      if ((user && !error) || isLoading) return
      let returnToPath: string

      if (!returnTo) {
        const currentLocation = window.location.toString()
        returnToPath = currentLocation.replace(new URL(currentLocation).origin, '') || '/'
      } else {
        returnToPath = returnTo
      }

      window.location.assign(`/?returnTo=${encodeURIComponent(returnToPath)}`)
    }, [user, error, isLoading, returnTo])

    if (error) return onError(error)
    if (user) return <Component user={user} {...(props as any)} />

    return onRedirecting()
  }
}
