'use client'
import { Ibarra_Real_Nova, Mukta } from 'next/font/google'
import { ReactNode, useCallback } from 'react'

import Providers, { NavigationProvider } from '@components/providers'
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

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const navigateTo = useCallback((path: string) => router.push(path), [router])
  const getLocation = useCallback(() => (pathname ? pathname : '/'), [pathname])

  return (
    <html lang="en">
      <body className={`${ibarra.variable} ${mukta.variable}`}>
        <NavigationProvider getLocation={getLocation} navigateTo={navigateTo}>
          <Providers>{children}</Providers>
        </NavigationProvider>
      </body>
    </html>
  )
}
