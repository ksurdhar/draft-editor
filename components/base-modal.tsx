import { Modal, Button } from '@mui/material'
import { ReactNode } from 'react'

export interface BaseModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  actions?: {
    label: string
    onClick: () => void
    color?: string
    hoverStyle?: React.CSSProperties
  }[]
}

export const BaseModal = ({ open, onClose, title, children, actions = [] }: BaseModalProps) => {
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
        }
      }}
    >
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
        }}
      >
        <h3 className="mb-4 uppercase text-black/[.70]">{title}</h3>
        {children}
        <div className="flex justify-end gap-2">
          {actions.map((action, index) => (
            <Button
              key={index}
              onClick={action.onClick}
              sx={{
                color: action.color || 'rgba(0, 0, 0, 0.7)',
                textTransform: 'uppercase',
                '&:hover': action.hoverStyle || {
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                },
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

export default BaseModal 