'use client'
import { useMemo } from 'react'
import { ChatIcon, RefreshIcon } from '@heroicons/react/outline'
import { ListItem } from './list-item'

interface DialogueListProps {
  documentId: string
  currentContent: any
  onSyncDialogue: () => Promise<void>
  isSyncing: boolean
}

interface DialogueMark {
  type: 'dialogue'
  attrs: {
    character: string
    conversationId: string
  }
}

interface ProcessedDialogueMark {
  id: string
  character: string
  content: string
  conversationId: string
}

interface GroupedDialogue {
  conversationId: string
  dialogues: ProcessedDialogueMark[]
}

const DialogueList = ({ currentContent, onSyncDialogue, isSyncing }: DialogueListProps) => {
  // Extract dialogue marks from the document content
  const dialogueMarks = useMemo(() => {
    if (!currentContent?.content) return []
    const marks: ProcessedDialogueMark[] = []

    // Recursively traverse the document tree to find text nodes with dialogue marks
    const processNode = (node: any, textOffset = 0): number => {
      if (!node) return textOffset

      // If this is a text node, check for dialogue marks
      if (node.type === 'text' && node.text) {
        const nodeMarks = node.marks || []
        const dialogueMarks = nodeMarks.filter((mark: any) => mark.type === 'dialogue')

        if (dialogueMarks.length > 0) {
          dialogueMarks.forEach((mark: DialogueMark) => {
            marks.push({
              id: `${textOffset}-${textOffset + node.text.length}`,
              character: mark.attrs.character,
              content: node.text,
              conversationId: mark.attrs.conversationId,
            })
          })
        }

        return textOffset + node.text.length
      }

      // If the node has content, process each child node
      if (node.content) {
        let currentOffset = textOffset
        node.content.forEach((child: any) => {
          currentOffset = processNode(child, currentOffset)
        })
        return currentOffset
      }

      return textOffset
    }

    // Start processing from the root node
    processNode(currentContent)

    return marks
  }, [currentContent])

  // Group dialogues by conversation
  const groupedDialogues = useMemo(() => {
    const groups: Record<string, ProcessedDialogueMark[]> = {}

    dialogueMarks.forEach(mark => {
      if (!groups[mark.conversationId]) {
        groups[mark.conversationId] = []
      }
      groups[mark.conversationId].push(mark)
    })

    return Object.entries(groups).map(([conversationId, dialogues]) => ({
      conversationId,
      dialogues: dialogues.sort((a, b) => {
        const [aStart] = a.id.split('-').map(Number)
        const [bStart] = b.id.split('-').map(Number)
        return aStart - bStart
      }),
    }))
  }, [dialogueMarks])

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400">Dialogue</h2>
        <button
          onClick={onSyncDialogue}
          disabled={isSyncing}
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-gray-400 transition-colors hover:bg-white/[.05] hover:text-gray-600">
          <RefreshIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="text-xs">{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {dialogueMarks.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-black/50">
            {isSyncing ? 'Scanning for dialogue...' : 'No dialogue detected'}
          </div>
        </div>
      ) : (
        groupedDialogues.map((group: GroupedDialogue) => (
          <div key={group.conversationId} className="mb-4">
            <div className="mb-2 text-xs font-medium text-black/50">
              Conversation {group.conversationId.replace('conv', '')}
            </div>
            {group.dialogues.map((mark: ProcessedDialogueMark) => (
              <ListItem
                key={mark.id}
                label={`${mark.character}: ${mark.content.substring(0, 30)}${mark.content.length > 30 ? '...' : ''}`}
                leftIcon={<ChatIcon className="h-4 w-4" />}
                theme="dark"
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

export default DialogueList
