import type { Metadata, NextPage } from 'next'
import Link from 'next/link'
import styles from '../styles/Home.module.css'

export const metadata: Metadata = {
  title: 'whetstone',
}

const Home: NextPage = () => {
  return (
    <div className={`${styles.container} font-index`}>
      <div className='gradient absolute top-0 left-0 h-screen w-screen z-[-1]'/>
      <main className={`${styles.main}`}>
      <Link href="/documents">
        <div className={'cursor-pointer'}>
          <div className={`text-black/[.78] text-[78px]`}>
            whetstone
          </div>
          <h2 className={`font-editor2 text-black/[.5] text-[30px]`}>
            The writing app for editing.
          </h2>
        </div>
      </Link>
      </main>
    </div>
  )
}

export default Home
