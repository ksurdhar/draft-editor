import { useCallback, useEffect, useState } from 'react'
import { Editor } from '@tiptap/react'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import {
  getConfirmedMarksFromDoc,
  processDialogueDetectionResult,
  applyDialogueMarks,
  preserveConfirmedMarks,
} from '../../lib/utils/dialogue-utils'

// Hook for handling dialogue confirmation
export const useDialogueConfirmation = (editor: Editor | null, debouncedSave: (data: any) => void) => {
  const handleConfirmDialogue = useCallback(
    (markId: string, character: string, conversationId: string, confirmed: boolean) => {
      if (!editor) return

      // The markId is expected to be "start-end"
      const [startStr, endStr] = markId.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (isNaN(start) || isNaN(end)) {
        console.error('Invalid markId format:', markId)
        return
      }

      const { state } = editor
      const { schema } = state
      let tr = state.tr

      // 1. Remove any existing dialogue mark in the range
      tr = tr.removeMark(start, end, schema.marks.dialogue)
      // 2. Add the new mark with updated attributes
      tr = tr.addMark(
        start,
        end,
        schema.marks.dialogue.create({
          character: character,
          conversationId: conversationId === 'unknown' ? undefined : conversationId,
          userConfirmed: confirmed,
        }),
      )

      editor.view.dispatch(tr)

      const updatedContent = editor.getJSON()
      debouncedSave({ content: updatedContent })
    },
    [editor, debouncedSave],
  )

  return { handleConfirmDialogue }
}

// Hook for handling dialogue sync
export const useDialogueSync = (
  editor: Editor | null,
  documentId: string,
  documentContent: any,
  post: (path: string, data: any) => Promise<any>,
  debouncedSave: (data: any) => void,
  setCurrentContent?: (content: any) => void,
  setDialogueDoc?: (content: any) => void,
  isDialogueMode?: boolean,
) => {
  const [isSyncingDialogue, setIsSyncingDialogue] = useState(false)

  const syncDialogue = useCallback(async () => {
    if (!documentContent || isSyncingDialogue || !editor) return

    setIsSyncingDialogue(true)
    try {
      // 1. Collect known characters from confirmed dialogue marks
      const knownCharacters: Set<string> = new Set()

      editor.state.doc.descendants((node: ProseMirrorNode, _pos: number) => {
        if (node.isText) {
          const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')
          if (dialogueMark?.attrs.userConfirmed && dialogueMark.attrs.character) {
            knownCharacters.add(dialogueMark.attrs.character)
          }
        }
      })

      const text = editor.state.doc.textContent
      const response = await post('/dialogue/detect', {
        text,
        knownCharacters: Array.from(knownCharacters),
      })

      // Ensure response structure matches expected DialogueDetectionResult[]
      const detectedDialogues: { character: string; snippet: string; conversationId: string }[] =
        Array.isArray(response) ? response : response?.dialogues || []

      if (!detectedDialogues) {
        throw new Error('Invalid response from dialogue detection')
      }

      // Get all confirmed dialogue marks using the utility function
      const confirmedRanges = getConfirmedMarksFromDoc(editor.state.doc)

      // Group detected dialogues by conversationId for naming
      const conversationSnippets: Record<string, string[]> = {}
      detectedDialogues.forEach(dialogue => {
        const convId = dialogue.conversationId
        if (!conversationSnippets[convId]) {
          conversationSnippets[convId] = []
        }
        conversationSnippets[convId].push(dialogue.snippet)
      })

      // Call the conversation naming API
      let nameMap = new Map<string, string>()
      if (Object.keys(conversationSnippets).length > 0) {
        try {
          const nameResponse = await post('/dialogue/name-conversations', {
            conversations: Object.entries(conversationSnippets).map(([id, snippets]) => ({
              id,
              snippets,
            })),
          })

          // Build the name map with document-specific conversation IDs
          if (nameResponse?.names) {
            nameMap = new Map(
              nameResponse.names.map((n: { id: string; name: string }) => [`${documentId}-${n.id}`, n.name]),
            )
          }
        } catch (error) {
          console.error('Failed to name conversations:', error)
          // Continue with dialogue sync even if naming fails
        }
      }

      // Process the detected dialogues with the utility function
      const { processedDialogues } = processDialogueDetectionResult(detectedDialogues, documentId, nameMap)

      // Apply the dialogue marks to the document using the utility functions
      let tr = editor.state.tr

      // First, apply new dialogue marks
      const { tr: markedTr } = applyDialogueMarks(editor, processedDialogues, confirmedRanges)
      tr = markedTr

      // Then ensure confirmed marks are preserved
      const { tr: preservedTr } = preserveConfirmedMarks(editor, confirmedRanges, tr)
      tr = preservedTr

      // Dispatch the final transaction
      editor.view.dispatch(tr)

      // Get the final updated content
      const updatedContent = editor.getJSON()
      if (setCurrentContent) {
        setCurrentContent(updatedContent)
      }
      if (setDialogueDoc) {
        setDialogueDoc(updatedContent) // Ensure dialogue list also updates
      }

      // Save the updated content
      await debouncedSave({ content: updatedContent })

      if (isDialogueMode) {
        setTimeout(() => {
          editor.commands.setDialogueHighlight(true)
        }, 50)
      }
    } catch (e) {
      console.error('Failed to sync dialogue:', e)
    } finally {
      setIsSyncingDialogue(false)
    }
  }, [
    documentContent,
    isSyncingDialogue,
    editor,
    documentId,
    post,
    debouncedSave,
    setCurrentContent,
    setDialogueDoc,
    isDialogueMode,
  ])

  return { syncDialogue, isSyncingDialogue }
}

// Hook for handling dialogue highlight
export const useDialogueHighlight = (editor: Editor | null, isDialogueMode: boolean) => {
  useEffect(() => {
    if (editor) {
      if (isDialogueMode) {
        editor.commands.setDialogueHighlight(true)
      } else {
        editor.commands.clearDialogueHighlight()
      }
    }
  }, [editor, isDialogueMode])
}

// Hook for removing all dialogue marks
export const useRemoveAllDialogueMarks = (editor: Editor | null, debouncedSave: (data: any) => void) => {
  const removeAllDialogueMarks = useCallback(() => {
    if (!editor) return

    const { state } = editor
    const { schema } = state
    let tr = state.tr

    // Find all dialogue marks and remove them
    editor.state.doc.descendants((node, pos) => {
      if (node.isText) {
        const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')
        if (dialogueMark) {
          tr = tr.removeMark(pos, pos + node.nodeSize, schema.marks.dialogue)
        }
      }
      return true
    })

    // Apply the transaction
    editor.view.dispatch(tr)

    // Save the updated content
    const updatedContent = editor.getJSON()
    debouncedSave({ content: updatedContent })
  }, [editor, debouncedSave])

  return { removeAllDialogueMarks }
}

// Hook for handling conversation rename
export const useConversationRename = (editor: Editor | null, debouncedSave: (data: any) => void) => {
  const handleUpdateConversationName = useCallback(
    (conversationId: string, newName: string) => {
      if (!editor) return
      editor.chain().focus().updateConversationName(conversationId, newName).run()

      // Trigger save after update
      const currentEditorContent = editor.getJSON()
      debouncedSave({ content: JSON.stringify(currentEditorContent) })
    },
    [editor, debouncedSave],
  )

  return { handleUpdateConversationName }
}

// Hook for combining all dialogue-related functionality
export const useDialogue = (
  editor: Editor | null,
  documentId: string,
  documentContent: any,
  post: (path: string, data: any) => Promise<any>,
  debouncedSave: (data: any) => void,
  options?: {
    setCurrentContent?: (content: any) => void
    setDialogueDoc?: (content: any) => void
    isDialogueMode?: boolean
  },
) => {
  const { handleConfirmDialogue } = useDialogueConfirmation(editor, debouncedSave)

  const { syncDialogue, isSyncingDialogue } = useDialogueSync(
    editor,
    documentId,
    documentContent,
    post,
    debouncedSave,
    options?.setCurrentContent,
    options?.setDialogueDoc,
    options?.isDialogueMode,
  )

  useDialogueHighlight(editor, options?.isDialogueMode || false)

  const { handleUpdateConversationName } = useConversationRename(editor, debouncedSave)

  const { removeAllDialogueMarks } = useRemoveAllDialogueMarks(editor, debouncedSave)

  const [focusedConversationId, setFocusedConversationId] = useState<string | null>(null)

  const toggleConversationFocus = useCallback(
    (conversationId: string) => {
      if (!editor) return

      const newFocusedId = focusedConversationId === conversationId ? null : conversationId
      setFocusedConversationId(newFocusedId)
      editor.commands.setDialogueFocus(newFocusedId)
    },
    [editor, focusedConversationId],
  )

  return {
    handleConfirmDialogue,
    syncDialogue,
    isSyncingDialogue,
    handleUpdateConversationName,
    focusedConversationId,
    toggleConversationFocus,
    removeAllDialogueMarks,
  }
}
