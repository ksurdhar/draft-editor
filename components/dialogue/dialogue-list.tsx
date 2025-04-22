'use client'
import { useMemo, useState, useEffect } from 'react'
import { RefreshIcon, CheckCircleIcon, EyeIcon, EyeOffIcon } from '@heroicons/react/outline'
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/solid'
import { ListItem } from '../list-item'
import { Editor } from '@tiptap/react'

interface DialogueListProps {
  documentId: string
  currentContent: any
  editor: Editor | null
  onSyncDialogue: () => Promise<void>
  isSyncing: boolean
  onConfirmDialogue: (markId: string, character: string, conversationId: string, confirmed: boolean) => void
  focusedConversationId: string | null
  onToggleFocus: (conversationId: string) => void
  onUpdateConversationName: (conversationId: string, newName: string) => void
}

interface DialogueMark {
  type: 'dialogue'
  attrs: {
    character: string
    conversationId: string
    conversationName?: string
    userConfirmed?: boolean
  }
}

interface ProcessedDialogueMark {
  id: string
  character: string
  content: string
  conversationId: string | null
  conversationName: string | null
  userConfirmed?: boolean
}

interface GroupedDialogue {
  conversationId: string
  conversationName: string | null
  dialogues: ProcessedDialogueMark[]
}

const DialogueList = ({
  editor,
  onSyncDialogue,
  isSyncing,
  onConfirmDialogue,
  focusedConversationId,
  onToggleFocus,
  onUpdateConversationName,
}: DialogueListProps) => {
  const [processedMarks, setProcessedMarks] = useState<ProcessedDialogueMark[]>([])
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [conversationNameInput, setConversationNameInput] = useState('')

  // Helper function to get the display part of the conversation ID
  const getBaseConvDisplay = (uniqueId: string | null): string => {
    if (!uniqueId || uniqueId === 'unknown') {
      return 'Unknown'
    }
    const parts = uniqueId.split('-')
    const lastPart = parts[parts.length - 1]
    if (lastPart.startsWith('conv')) {
      return lastPart.substring(4) // Remove 'conv'
    }
    return lastPart // Fallback if format is unexpected
  }

  useEffect(() => {
    if (!editor) {
      setProcessedMarks([])
      return
    }

    const calculateMarks = (): ProcessedDialogueMark[] => {
      if (!editor.state.doc) return []

      const doc = editor.state.doc
      const marks: ProcessedDialogueMark[] = []
      let currentGroup: ProcessedDialogueMark | null = null

      doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const text = node.text
          const nodeEndPos = pos + node.nodeSize
          const dialogueMarkData = node.marks.find(mark => mark.type.name === 'dialogue')

          if (dialogueMarkData) {
            const markAttrs = dialogueMarkData.attrs as DialogueMark['attrs']
            const markInfo = {
              character: markAttrs.character,
              conversationId: markAttrs.conversationId || null,
              conversationName: markAttrs.conversationName || null,
              userConfirmed: markAttrs.userConfirmed || false,
            }

            if (
              currentGroup &&
              currentGroup.character === markInfo.character &&
              currentGroup.conversationId === markInfo.conversationId &&
              currentGroup.conversationName === markInfo.conversationName &&
              pos === parseInt(currentGroup.id.split('-')[1], 10)
            ) {
              currentGroup.content += text
              const [start] = currentGroup.id.split('-').map(Number)
              currentGroup.id = `${start}-${nodeEndPos}`
              if (markInfo.userConfirmed) {
                currentGroup.userConfirmed = true
              }
            } else {
              if (currentGroup) {
                marks.push(currentGroup)
              }
              currentGroup = {
                id: `${pos}-${nodeEndPos}`,
                character: markInfo.character,
                content: text,
                conversationId: markInfo.conversationId,
                conversationName: markInfo.conversationName,
                userConfirmed: markInfo.userConfirmed,
              }
            }
          } else {
            if (currentGroup) {
              marks.push(currentGroup)
              currentGroup = null
            }
          }
          return true
        } else {
          if (currentGroup) {
            marks.push(currentGroup)
            currentGroup = null
          }
          return true
        }
      })

      if (currentGroup) {
        marks.push(currentGroup)
      }

      const filteredMarks = marks.filter(mark => mark.content.trim().length > 0)
      return filteredMarks
    }

    setProcessedMarks(calculateMarks())

    const handleTransaction = () => {
      const newMarks = calculateMarks()
      setProcessedMarks(newMarks)
    }

    editor.on('transaction', handleTransaction)

    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor])

  const groupedDialogues = useMemo(() => {
    type GroupData = { dialogues: ProcessedDialogueMark[]; conversationName: string | null }
    const groups: Record<string, GroupData> = {}

    processedMarks.forEach(mark => {
      const convId = mark.conversationId ?? 'unknown'
      if (!groups[convId]) {
        groups[convId] = { dialogues: [], conversationName: null }
      }

      if (groups[convId].conversationName === null && mark.conversationName) {
        groups[convId].conversationName = mark.conversationName
      }

      groups[convId].dialogues.push(mark)
    })

    const grouped: GroupedDialogue[] = Object.entries(groups)
      .map(([conversationId, groupData]) => ({
        conversationId,
        conversationName: groupData.conversationName,
        dialogues: groupData.dialogues.sort((a, b) => {
          const [aStart] = a.id.split('-').map(Number)
          const [bStart] = b.id.split('-').map(Number)
          return aStart - bStart
        }),
      }))
      .sort((a, b) => {
        const firstAStart = a.dialogues[0]?.id.split('-').map(Number)[0] ?? Infinity
        const firstBStart = b.dialogues[0]?.id.split('-').map(Number)[0] ?? Infinity
        return firstAStart - firstBStart
      })

    return grouped
  }, [processedMarks])

  const handleDoubleClickConversation = (convId: string, currentName: string | null) => {
    setEditingConversationId(convId)
    setConversationNameInput(currentName || '')
  }

  const handleSaveConversationName = () => {
    if (!editingConversationId) return
    const newName = conversationNameInput.trim()
    onUpdateConversationName(editingConversationId, newName)
    setEditingConversationId(null)
    setConversationNameInput('')
  }

  const handleCancelEditConversationName = () => {
    setEditingConversationId(null)
    setConversationNameInput('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400">Dialogue</h2>
        <button
          onClick={onSyncDialogue}
          disabled={isSyncing}
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-gray-400 transition-colors hover:bg-white/[.05] hover:text-gray-600 disabled:opacity-50">
          <RefreshIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span className="text-xs">{isSyncing ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {processedMarks.length === 0 ? (
        <div className="flex h-full items-center justify-center py-10">
          <div className="text-center text-xs text-black/50">
            {isSyncing ? 'Scanning for dialogue...' : 'No dialogue detected or Sync needed.'}
          </div>
        </div>
      ) : (
        groupedDialogues.map((group: GroupedDialogue) => (
          <div
            key={group.conversationId}
            className="mb-1 rounded-md border border-white/[.07] bg-white/[.01]">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-black/40">
              {editingConversationId === group.conversationId ? (
                <div className="flex flex-grow items-center gap-1">
                  <input
                    type="text"
                    value={conversationNameInput}
                    onChange={e => setConversationNameInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleSaveConversationName()
                      } else if (e.key === 'Escape') {
                        handleCancelEditConversationName()
                      }
                    }}
                    className="flex-grow rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-xs text-black/80 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    placeholder="Conversation Name"
                    autoFocus
                    onBlur={handleCancelEditConversationName}
                  />
                </div>
              ) : (
                <span
                  onDoubleClick={() =>
                    handleDoubleClickConversation(group.conversationId, group.conversationName)
                  }
                  className="cursor-pointer rounded px-1 py-0.5 hover:bg-white/[.08]"
                  title="Double-click to rename">
                  {group.conversationName ? (
                    <>
                      {group.conversationName}{' '}
                      <span className="text-black/30">
                        (
                        {group.conversationId === 'unknown'
                          ? 'Unknown'
                          : getBaseConvDisplay(group.conversationId)}
                        )
                      </span>
                    </>
                  ) : (
                    <>
                      Conversation{' '}
                      {group.conversationId === 'unknown'
                        ? 'Unknown'
                        : getBaseConvDisplay(group.conversationId)}
                    </>
                  )}
                </span>
              )}
              <button
                onClick={() => onToggleFocus(group.conversationId)}
                className={`rounded p-1 transition-colors ${focusedConversationId === group.conversationId ? 'bg-blue-500/20 text-blue-400' : 'text-black/40 hover:bg-white/[.05] hover:text-black/60'}`}
                title={
                  focusedConversationId === group.conversationId
                    ? 'Unfocus conversation'
                    : 'Focus conversation'
                }>
                {focusedConversationId === group.conversationId ? (
                  <EyeOffIcon className="h-3.5 w-3.5" />
                ) : (
                  <EyeIcon className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="border-t border-white/[.07]">
              {group.dialogues.map((mark: ProcessedDialogueMark) => (
                <div key={mark.id} className="border-b border-white/[.05] last:border-b-0">
                  <ListItem
                    label={
                      <div className="flex min-w-0 items-baseline">
                        <span className="mr-1 flex-shrink-0 font-medium text-black/70">
                          {mark.character}:
                        </span>
                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-black/60">
                          {mark.content}
                        </span>
                      </div>
                    }
                    leftIcon={
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          onConfirmDialogue(
                            mark.id,
                            mark.character,
                            mark.conversationId ?? 'unknown',
                            !mark.userConfirmed,
                          )
                        }}
                        className="mr-2 rounded p-1 transition-colors hover:bg-white/[.1]"
                        title={mark.userConfirmed ? 'Mark as unconfirmed' : 'Mark as confirmed'}>
                        {mark.userConfirmed ? (
                          <CheckCircleIconSolid className="h-4 w-4 text-green-400/80" />
                        ) : (
                          <CheckCircleIcon className="h-4 w-4 text-black/40" />
                        )}
                      </button>
                    }
                    onClick={undefined}
                    rightIcon={null}
                    theme="dark"
                    itemContainerProps={{
                      className: 'transition-colors duration-150',
                      onMouseEnter: () => {
                        if (editor) {
                          const [start, end] = mark.id.split('-').map(Number)
                          if (!isNaN(start) && !isNaN(end)) {
                            // Example: editor.commands.setHighlight({ from: start, to: end }, 'hover-highlight')
                          }
                        }
                      },
                      onMouseLeave: () => {
                        if (editor) {
                          // Example: editor.commands.unsetHighlight('hover-highlight')
                        }
                      },
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default DialogueList
