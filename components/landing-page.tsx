import styles from '@styles/Home.module.css'
import React from 'react'

export const Titles = () => {
  return (
    <div className={'cursor-pointer'}>
      <div className={`text-black/[.78] text-[78px]`}>
        whetstone
      </div>
      <h2 className={`font-editor2 text-black/[.5] text-[30px]`}>
        The writing app for editing.
      </h2>
    </div>
  )
}

export const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className={`${styles.container} font-index`}>
      <div className='gradient absolute top-0 left-0 h-screen w-screen z-[-1]'/>
      <main className={`${styles.main}`}>
        { children }
      </main>
    </div>
  )
}