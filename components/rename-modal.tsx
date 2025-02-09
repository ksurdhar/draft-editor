import { useState, useEffect, useRef } from 'react'
import BaseModal from './base-modal'

interface RenameModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (newName: string) => void
  initialValue: string
}

const RenameModal = ({ open, onClose, onConfirm, initialValue }: RenameModalProps) => {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setValue(initialValue)
      // Focus the input after a short delay to ensure the modal is fully rendered
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [open, initialValue])

  const handleSubmit = () => {
    onConfirm(value)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title="RENAME DOCUMENT"
      actions={[
        {
          label: 'CANCEL',
          onClick: onClose
        },
        {
          label: 'RENAME',
          onClick: handleSubmit
        }
      ]}
    >
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        onKeyDown={handleKeyDown}
        className="mb-4 w-full rounded border border-black/[.10] bg-white/[.20] p-2 uppercase text-black/[.70] outline-none focus:ring-0 focus:border-black/[.10] focus:bg-white/[.25]"
        placeholder="DOCUMENT NAME"
      />
    </BaseModal>
  )
}

export default RenameModal 