import type { NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  return (
    <div className={`${styles.container} font-index`}>
      <Head>
        <title>whetstone</title>
      </Head>
      <div className='gradient absolute top-0 left-0 h-screen w-screen z-[-1]'/>
      <main className={`${styles.main}`}>
      <Link href="/documents">
        <div className={'cursor-pointer'}>
          <div className={`text-black/[.78] text-[78px]`}>
            whetstone
          </div>
          <h2 className="font-editor2 text-black/[.5] text-[30px]">
            The writing app for editing.
          </h2>
        </div>
      </Link>
      </main>
    </div>
  )
}

export default Home
