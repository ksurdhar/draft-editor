import { Modal, Button } from '@mui/material'
import { useEffect } from 'react'

export interface BaseModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmText?: string
  onConfirm?: () => void
  children?: React.ReactNode
  actions?: Array<{
    label: string
    onClick: () => void
    hoverStyle?: {
      backgroundColor: string
    }
  }>
}

export const BaseModal = ({
  open,
  onClose,
  title,
  description,
  confirmText = 'CONFIRM',
  onConfirm,
  children,
  actions,
}: BaseModalProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && onConfirm) {
        onConfirm()
      }
    }

    if (open) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onConfirm])

  const defaultActions = onConfirm
    ? [
        {
          label: 'CANCEL',
          onClick: onClose,
        },
        {
          label: confirmText,
          onClick: onConfirm,
          hoverStyle: {
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
          },
        },
      ]
    : [
        {
          label: 'CLOSE',
          onClick: onClose,
        },
      ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '& .MuiBackdrop-root': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(1px)',
        },
      }}>
      <div
        className="p-6 outline-none"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '6px',
          fontFamily: 'Mukta, sans-serif',
          minWidth: '300px',
          width: '480px',
        }}>
        <h3 className="mb-4 uppercase text-black/[.70]">{title}</h3>
        {description && (
          <p className="mb-4 text-black/[.70] focus:outline-none [&_*]:focus:outline-none">{description}</p>
        )}
        {children}
        <div className="flex justify-end gap-2">
          {(actions || defaultActions).map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              sx={{
                color: 'rgba(0, 0, 0, 0.7)',
                textTransform: 'uppercase',
                '&:hover': action.hoverStyle || {
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                },
              }}>
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

export default BaseModal
