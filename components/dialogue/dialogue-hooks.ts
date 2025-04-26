import { useCallback, useEffect, useState } from 'react'
import { Editor } from '@tiptap/react'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import { findAllMatches } from '../../lib/search'

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

      // Store confirmed marks before making changes
      const confirmedRanges = new Map<
        string,
        {
          character: string
          conversationId: string
          conversationName?: string | null
        }
      >()

      editor.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
        if (node.isText) {
          const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')
          if (dialogueMark?.attrs.userConfirmed) {
            const rangeKey = `${pos}-${pos + node.nodeSize}`
            confirmedRanges.set(rangeKey, {
              character: dialogueMark.attrs.character,
              conversationId: dialogueMark.attrs.conversationId,
              conversationName: dialogueMark.attrs.conversationName,
            })
          }
        }
      })

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

      // Start a Tiptap transaction to batch changes
      let tr = editor.state.tr

      // 1. Remove all *existing* non-confirmed dialogue marks first
      editor.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
        if (node.isText) {
          const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')
          if (dialogueMark && !dialogueMark.attrs.userConfirmed) {
            tr = tr.removeMark(pos, pos + node.nodeSize, editor.schema.marks.dialogue)
          }
        }
      })

      // Apply the transaction to remove marks before adding new ones
      editor.view.dispatch(tr)
      tr = editor.state.tr // Get a new transaction based on the updated state

      // 2. Apply *new* marks from AI, skipping confirmed ranges
      for (const dialogue of detectedDialogues) {
        const matches = findAllMatches(editor.state.doc, dialogue.snippet)
        for (const match of matches) {
          const rangeKey = `${match.from}-${match.to}`
          // Construct the unique conversation ID
          const uniqueConversationId = dialogue.conversationId
            ? `${documentId}-${dialogue.conversationId}`
            : `${documentId}-unknown`

          if (confirmedRanges.has(rangeKey)) {
            // If confirmed, ensure its ID matches what we expect, otherwise log potential issue
            const confirmedAttrs = confirmedRanges.get(rangeKey)
            if (confirmedAttrs?.conversationId !== uniqueConversationId) {
              console.warn(
                `Confirmed range ${rangeKey} has ID ${confirmedAttrs?.conversationId}, but new detection suggests ${uniqueConversationId} for snippet "${dialogue.snippet}". Keeping confirmed ID.`,
              )
            }
            continue
          }

          // Get conversation name from the map or keep the existing one
          const conversationName = nameMap.get(uniqueConversationId) || null

          tr = tr.addMark(
            match.from,
            match.to,
            editor.schema.marks.dialogue.create({
              character: dialogue.character,
              conversationId: uniqueConversationId, // Use unique ID
              conversationName: conversationName,
              userConfirmed: false,
            }),
          )
        }
      }

      // 3. Re-apply confirmed marks
      confirmedRanges.forEach((attrs, rangeKey) => {
        const [from, to] = rangeKey.split('-').map(Number)
        // Construct the unique conversation ID expected for the confirmed mark
        const uniqueConversationId = attrs.conversationId
          ? `${documentId}-${attrs.conversationId}`
          : `${documentId}-unknown`
        let needsReapply = true
        editor.state.doc.nodesBetween(from, to, (node: ProseMirrorNode, pos: number) => {
          // Check if a confirmed mark with the *correct unique ID* already exists
          if (pos === from && node.isText) {
            const existingMark = node.marks.find(m => m.type.name === 'dialogue')
            if (
              existingMark &&
              existingMark.attrs.userConfirmed &&
              existingMark.attrs.character === attrs.character &&
              existingMark.attrs.conversationId === uniqueConversationId // Check unique ID
            ) {
              needsReapply = false
            }
          }
        })

        if (needsReapply && !isNaN(from) && !isNaN(to)) {
          // Apply the mark with the unique ID, preserving existing conversationName
          tr = tr.addMark(
            from,
            to,
            editor.schema.marks.dialogue.create({
              ...attrs,
              conversationId: uniqueConversationId,
              // Keep existing conversationName if it exists
              conversationName: attrs.conversationName || nameMap.get(uniqueConversationId) || null,
              userConfirmed: true,
            }),
          )
        }
      })

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
