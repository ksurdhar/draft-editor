import BaseModal from './base-modal'

interface DeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  documentTitle: string
}

const DeleteModal = ({ open, onClose, onConfirm, documentTitle }: DeleteModalProps) => {
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
          onClick: () => {
            onConfirm()
            onClose()
          },
          hoverStyle: {
            backgroundColor: 'rgba(239, 68, 68, 0.15)'
          }
        }
      ]}
    >
      <p className="mb-4 text-black/[.70]">
        ARE YOU SURE YOU WANT TO DELETE &ldquo;{documentTitle}&rdquo;?
      </p>
    </BaseModal>
  )
}

export default DeleteModal 