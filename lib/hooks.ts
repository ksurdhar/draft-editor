import { useEffect, useState } from 'react'

export const useSpinner = () => {
  const [ allowSpinner, setAllowSpinner ] = useState(false)
  useEffect(() => {
    setTimeout(() => {
      setAllowSpinner(true)
    }, 250)
  }, [allowSpinner])
  return allowSpinner
}