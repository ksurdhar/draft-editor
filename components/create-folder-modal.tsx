import { useEffect } from 'react'
import BaseModal from './base-modal'

interface CreateFolderModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (folderName: string) => void
}

const CreateFolderModal = ({ open, onClose, onConfirm }: CreateFolderModalProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      
      if (e.key === 'Enter') {
        e.preventDefault()
        const input = document.getElementById('folder-name-input') as HTMLInputElement
        if (input && input.value.trim()) {
          onConfirm(input.value.trim())
          onClose()
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, onConfirm])

  const handleCreate = () => {
    const input = document.getElementById('folder-name-input') as HTMLInputElement
    if (input && input.value.trim()) {
      onConfirm(input.value.trim())
      onClose()
    }
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="CREATE FOLDER"
      description="Enter a name for the new folder:"
      confirmText="CREATE"
      onConfirm={handleCreate}
    >
      <input
        id="folder-name-input"
        type="text"
        className="w-full rounded-lg border border-black/[.10] bg-white/[.07] px-4 py-2 text-black/[.70] outline-none placeholder:text-black/[.25] focus:border-black/[.15]"
        placeholder="Folder name"
        autoFocus
      />
    </BaseModal>
  )
}

export default CreateFolderModal 