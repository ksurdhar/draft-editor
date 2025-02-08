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
          onClick: () => {
            onConfirm(value)
            onClose()
          }
        }
      ]}
    >
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value.toUpperCase())}
        className="mb-4 w-full rounded border-0 bg-white/[.20] p-2 uppercase text-black/[.70] outline-none"
        placeholder="DOCUMENT NAME"
      />
    </BaseModal>
  )
}

export default RenameModal 