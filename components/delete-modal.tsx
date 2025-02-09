import { useEffect } from 'react'
import BaseModal from './base-modal'

interface DeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  documentTitle: string
}

const DeleteModal = ({ open, onClose, onConfirm, documentTitle }: DeleteModalProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
        onClose()
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, onConfirm])

  const handleDelete = () => {
    onConfirm()
    onClose()
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="DELETE DOCUMENT"
      actions={[
        {
          label: 'CANCEL',
          onClick: onClose
        },
        {
          label: 'DELETE',
          onClick: handleDelete,
          hoverStyle: {
            backgroundColor: 'rgba(239, 68, 68, 0.15)'
          }
        }
      ]}
    >
      <p className="mb-4 text-black/[.70] focus:outline-none [&_*]:focus:outline-none">
        ARE YOU SURE YOU WANT TO DELETE&nbsp; &ldquo;{documentTitle}&rdquo;?
      </p>
    </BaseModal>
  )
}

export default DeleteModal 