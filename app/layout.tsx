'use client'
import { Ibarra_Real_Nova, Mukta } from 'next/font/google'
import { ReactNode, useCallback } from 'react'

import Providers, { APIProvider, NavigationProvider } from '@components/providers'
import { destroy, get, post, update, deleteMethod } from '@lib/http-utils'
import '@styles/globals.css'
import '@styles/hamburgers/hamburgers.scss'
import '@styles/loading-indicator.css'
import { usePathname, useRouter } from 'next/navigation'

const ibarra = Ibarra_Real_Nova({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ibarra',
})

const mukta = Mukta({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mukta',
  weight: ['400'],
})

// Might need to import Geist font from google here

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const navigateTo = useCallback((path: string) => router.push(path), [router])
  const getLocation = useCallback(() => (pathname ? pathname : '/'), [pathname])
  const signOut = useCallback(() => router.push('/api/auth/logout'), [router])

  return (
    <html lang="en">
      <body className={`${ibarra.variable} ${mukta.variable}`}>
        <NavigationProvider getLocation={getLocation} navigateTo={navigateTo} signOut={signOut}>
          <APIProvider destroy={destroy} patch={update} post={post} get={get} delete={deleteMethod}>
            <Providers>{children}</Providers>
          </APIProvider>
        </NavigationProvider>
      </body>
    </html>
  )
}
