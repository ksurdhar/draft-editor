'use client'
import { useMemo, useState, useEffect } from 'react'
import {
  ChatIcon,
  RefreshIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeOffIcon,
} from '@heroicons/react/outline'
import { ListItem } from './list-item'
import { useDebouncedCallback } from 'use-debounce'
import { AnimatePresence, motion } from 'framer-motion'
import { Editor } from '@tiptap/react'

interface DialogueListProps {
  documentId: string
  currentContent: any
  editor: Editor | null
  onSyncDialogue: () => Promise<void>
  isSyncing: boolean
  onConfirmDialogue: (markId: string, character: string, conversationId: string) => void
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
  currentContent,
  editor,
  onSyncDialogue,
  isSyncing,
  onConfirmDialogue,
  focusedConversationId,
  onToggleFocus,
  onUpdateConversationName,
}: DialogueListProps) => {
  const [validDialogueMarks, setValidDialogueMarks] = useState<ProcessedDialogueMark[]>([])
  const [expandedMarkId, setExpandedMarkId] = useState<string | null>(null)
  const [editingCharacter, setEditingCharacter] = useState<string>('')
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [conversationNameInput, setConversationNameInput] = useState('')

  const dialogueMarks = useMemo(() => {
    if (!editor || !editor.state.doc) {
      return []
    }

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
  }, [editor, currentContent])

  const validateDialogueMarks = useDebouncedCallback(
    () => {
      const doc = editor?.state.doc
      const contentToCheck = doc ? { type: 'doc', content: doc.content } : currentContent

      if (!contentToCheck?.content) {
        setValidDialogueMarks([])
        return
      }
      const checkNodeForMarkPresence = (targetMark: ProcessedDialogueMark): boolean => {
        let found = false
        const [start, end] = targetMark.id.split('-').map(Number)
        if (isNaN(start) || isNaN(end)) return false

        if (doc) {
          doc.descendants((node, pos) => {
            if (found) return false
            if (node.isText) {
              const nodeEnd = pos + node.nodeSize
              if (pos < end && nodeEnd > start) {
                const dialogueMark = node.marks.find(m => m.type.name === 'dialogue')
                if (
                  dialogueMark &&
                  (dialogueMark.attrs.conversationId || null) === targetMark.conversationId &&
                  dialogueMark.attrs.character === targetMark.character &&
                  (dialogueMark.attrs.conversationName || null) === targetMark.conversationName
                ) {
                  found = true
                }
              }
            }
            return !found
          })
        } else {
          console.warn('validateDialogueMarks: using currentContent fallback')
          contentToCheck?.content?.descendants((node: any, pos: number) => {
            if (found) return false
            if (node.isText) {
              const nodeEnd = pos + node.nodeSize
              if (pos < end && nodeEnd > start) {
                const dialogueMark = node.marks.find((m: any) => m.type === 'dialogue')
                if (
                  dialogueMark &&
                  (dialogueMark.attrs.conversationId || null) === targetMark.conversationId &&
                  dialogueMark.attrs.character === targetMark.character &&
                  (dialogueMark.attrs.conversationName || null) === targetMark.conversationName
                ) {
                  found = true
                }
              }
            }
            return true
          })
        }
        return found
      }

      const stillValidMarks = dialogueMarks.filter(checkNodeForMarkPresence)
      setValidDialogueMarks(stillValidMarks)
    },
    500,
    { leading: false, trailing: true },
  )

  useEffect(() => {
    setValidDialogueMarks(dialogueMarks)
    validateDialogueMarks()
  }, [dialogueMarks, validateDialogueMarks, editor])

  const groupedDialogues = useMemo(() => {
    type GroupData = { dialogues: ProcessedDialogueMark[]; conversationName: string | null }
    const groups: Record<string, GroupData> = {}

    validDialogueMarks.forEach(mark => {
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
  }, [validDialogueMarks])

  const handleToggleExpand = (markId: string, currentCharacter: string) => {
    if (expandedMarkId === markId) {
      setExpandedMarkId(null)
    } else {
      setExpandedMarkId(markId)
      setEditingCharacter(currentCharacter)
    }
  }

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

  const handleConfirm = (mark: ProcessedDialogueMark) => {
    onConfirmDialogue(mark.id, editingCharacter, mark.conversationId ?? 'unknown')
    setExpandedMarkId(null)
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

      {validDialogueMarks.length === 0 ? (
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
                          : group.conversationId.replace('conv', '')}
                        )
                      </span>
                    </>
                  ) : (
                    <>
                      Conversation{' '}
                      {group.conversationId === 'unknown'
                        ? 'Unknown'
                        : group.conversationId.replace('conv', '')}
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
                      <div className="flex items-center gap-2">
                        {mark.userConfirmed && (
                          <div title="Speaker confirmed by user">
                            <CheckCircleIcon className="h-3.5 w-3.5 flex-shrink-0 text-green-400/80" />
                          </div>
                        )}
                        <span>
                          <span className="font-medium text-black/70">{mark.character}:</span>{' '}
                          <span className="text-black/60">
                            {mark.content.substring(0, 50)}
                            {mark.content.length > 50 ? '...' : ''}
                          </span>
                        </span>
                      </div>
                    }
                    leftIcon={<ChatIcon className="mt-1 h-4 w-4 flex-shrink-0 text-black/40" />}
                    onClick={() => handleToggleExpand(mark.id, mark.character)}
                    rightIcon={
                      expandedMarkId === mark.id ? (
                        <ChevronUpIcon className="h-4 w-4 text-black/40" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-black/40" />
                      )
                    }
                    theme="dark"
                    itemContainerProps={{
                      className: `transition-colors duration-150 ${expandedMarkId === mark.id ? 'bg-white/[.05]' : ''}`,
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
                  <AnimatePresence>
                    {expandedMarkId === mark.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden bg-black/[.03]">
                        <div className="p-3">
                          <label className="mb-1 block text-xs font-medium text-black/60">
                            Confirm Speaker
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingCharacter}
                              onChange={e => setEditingCharacter(e.target.value)}
                              className="flex-grow rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-black/80 placeholder-black/40 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                              placeholder="Enter speaker name"
                            />
                            <button
                              onClick={() => handleConfirm(mark)}
                              disabled={!editingCharacter.trim()}
                              className="rounded bg-green-600/80 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Confirm this speaker">
                              Confirm
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
