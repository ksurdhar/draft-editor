import React from 'react'
import styles from '../styles/Home.module.css'

export const Titles = () => {
  return (
    <div className={'cursor-pointer'}>
      <div className={`text-[78px] text-black/[.78]`}>whetstone</div>
      <h2 className={`font-editor2 text-[30px] text-black/[.5]`}>The writing app for editing.</h2>
    </div>
  )
}

export const Container = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className={`${styles.container} font-index`}>
      <div className="gradient absolute left-0 top-0 z-[-1] h-screen w-screen" />
      <main className={`${styles.main}`}>{children}</main>
    </div>
  )
}
