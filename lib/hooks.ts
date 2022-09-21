import { useEffect, useState } from 'react'

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