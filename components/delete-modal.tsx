import { useEffect } from 'react'
import BaseModal from './base-modal'

interface DeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  documentTitle: string
  itemCount?: number // Optional count for multi-select cases
}

const DeleteModal = ({ open, onClose, onConfirm, documentTitle, itemCount }: DeleteModalProps) => {
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

  const getDescription = () => {
    if (itemCount && itemCount > 1) {
      return `Are you sure you want to delete these ${itemCount} items?`
    }
    return `Are you sure you want to delete ${documentTitle}?`
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="DELETE"
      description={getDescription()}
      confirmText="DELETE"
      onConfirm={handleDelete}
      actions={[
        {
          label: 'CANCEL',
          onClick: onClose,
        },
        {
          label: 'DELETE',
          onClick: handleDelete,
          hoverStyle: {
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
          },
        },
      ]}
    />
  )
}

export default DeleteModal
