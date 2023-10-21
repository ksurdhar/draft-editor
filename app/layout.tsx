import { Ibarra_Real_Nova, Mukta } from 'next/font/google'
import { ReactNode } from 'react'

import Providers from '@components/providers'
import '@styles/globals.css'
import '@styles/hamburgers/hamburgers.scss'
import '@styles/loading-indicator.css'

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

export default function Layout ({ children } : { children: ReactNode}) {
  return (
    <html lang='en'>
      <body className={`${ibarra.variable} ${mukta.variable}`}>
      <Providers>
        { children }
      </Providers>
      </body>
    </html>
  )
}