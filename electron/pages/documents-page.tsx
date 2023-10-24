import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'

const DocumentsPage = () => {
  const [_, setLocation] = useLocation()
  const [documents, setDocuments] = useState([])

  useEffect(() => {
    const fetchDocuments = async () => {
      const result = await window.electronAPI.getDocuments()
      console.log('result', result)
      setDocuments(result)
    }
    fetchDocuments()
  }, [])
  console.log('documents', documents)

  return (
    <div className='self-center text-center'>
      <a onClick={() => setLocation('/')}>You found your documents</a>
    </div>
  )
}

export default DocumentsPage
