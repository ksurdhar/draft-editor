import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { DocumentData } from '../types/globals'

export const useSpinner = (optionalCondition?: boolean) => {
  const [ allowSpinner, setAllowSpinner ] = useState(false)
  useEffect(() => {
    setTimeout(() => {
      setAllowSpinner(true)
    }, 333)
  }, [allowSpinner])

  if (typeof optionalCondition === undefined) {
    return allowSpinner
  } else {
    return allowSpinner && optionalCondition
  }
}

export const useSyncHybridDoc = (id: string, databaseDoc: DocumentData | undefined, setHybridDoc: Dispatch<SetStateAction<DocumentData | null | undefined>>) => {
  useEffect(() => {
    let cachedDoc: DocumentData | {} = {}
    if (typeof window !== 'undefined') {
      cachedDoc = JSON.parse(sessionStorage.getItem(id) || '{}')
    }
    const documentNotCached = Object.keys(cachedDoc).length === 0

    if (documentNotCached) {
      // console.log('document not cached, applying DB doc')
      setHybridDoc(databaseDoc)
    } else {
      // console.log('document cached, using session storage doc')
      setHybridDoc(cachedDoc as DocumentData)
    }
  }, [databaseDoc, setHybridDoc, id])
}