import { Editor } from '@tiptap/react'
import { Node as ProseMirrorNode } from 'prosemirror-model'
import { findAllMatches, findDialogueSnippet } from '../search'

/**
 * Types to better define dialogue marks and API responses
 */
export interface DialogueMark {
  character: string
  conversationId: string
  conversationName?: string | null
  userConfirmed?: boolean
}

export interface DialogueMatch {
  from: number
  to: number
}

export interface DialogueDetection {
  character: string
  snippet: string
  conversationId: string
}

export interface ConversationNameResult {
  id: string
  name: string
}

export interface DialogueDetectionResult {
  dialogues: DialogueDetection[]
}

export interface ConversationNamingResult {
  names: ConversationNameResult[]
}

export interface ConfirmedMarkRange {
  from: number
  to: number
  attrs: DialogueMark
}

/**
 * Extract all dialogue marks from a document that are confirmed by the user
 */
export function getConfirmedMarksFromDoc(doc: ProseMirrorNode): ConfirmedMarkRange[] {
  const confirmedRanges: ConfirmedMarkRange[] = []

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.isText) {
      const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')
      if (dialogueMark?.attrs.userConfirmed) {
        confirmedRanges.push({
          from: pos,
          to: pos + node.nodeSize,
          attrs: {
            character: dialogueMark.attrs.character,
            conversationId: dialogueMark.attrs.conversationId,
            conversationName: dialogueMark.attrs.conversationName,
            userConfirmed: dialogueMark.attrs.userConfirmed,
          },
        })
      }
    }
    return true
  })

  return confirmedRanges
}

/**
 * Process dialogue detection results from the API
 */
export function processDialogueDetectionResult(
  detectedDialogues: DialogueDetection[],
  documentId: string,
  nameMap: Map<string, string>,
): {
  processedDialogues: Array<
    DialogueDetection & { uniqueConversationId: string; conversationName: string | null }
  >
} {
  return {
    processedDialogues: detectedDialogues.map(dialogue => {
      // Construct the unique conversation ID
      const uniqueConversationId = dialogue.conversationId
        ? `${documentId}-${dialogue.conversationId}`
        : `${documentId}-unknown`

      // Get conversation name from the map
      const conversationName = nameMap.get(uniqueConversationId) || null

      return {
        ...dialogue,
        uniqueConversationId,
        conversationName,
      }
    }),
  }
}

/**
 * Apply dialogue marks to the document based on detected dialogues
 */
export function applyDialogueMarks(
  editor: Editor,
  processedDialogues: Array<
    DialogueDetection & { uniqueConversationId: string; conversationName: string | null }
  >,
  confirmedRanges: ConfirmedMarkRange[],
): { tr: any; marksApplied: number } {
  let tr = editor.state.tr
  let marksApplied = 0

  // First remove all non-confirmed dialogue marks
  editor.state.doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.isText) {
      const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')
      if (dialogueMark && !dialogueMark.attrs.userConfirmed) {
        tr = tr.removeMark(pos, pos + node.nodeSize, editor.schema.marks.dialogue)
      }
    }
  })

  // Map of ranges to skip (already confirmed)
  const confirmedRangeMap = new Map<string, boolean>()
  confirmedRanges.forEach(range => {
    confirmedRangeMap.set(`${range.from}-${range.to}`, true)
  })

  // Document size to validate positions
  const docSize = editor.state.doc.content.size

  // Document content is available via editor.state.doc.textContent if needed for debugging

  // Apply new marks, skipping confirmed ranges
  for (const dialogue of processedDialogues) {
    // First try to find exact matches
    let matches = findAllMatches(editor.state.doc, dialogue.snippet)

    // If no exact matches found, try to find dialogue spanning multiple paragraphs
    if (matches.length === 0) {
      matches = findDialogueSnippet(editor.state.doc, dialogue.snippet)
    }

    for (const match of matches) {
      // Skip invalid matches or those out of bounds
      if (
        !match ||
        match.from === undefined ||
        match.to === undefined ||
        match.from < 0 ||
        match.to > docSize ||
        match.from >= match.to
      ) {
        continue
      }

      const rangeKey = `${match.from}-${match.to}`

      // Skip if this range is already confirmed
      if (confirmedRangeMap.has(rangeKey)) {
        continue
      }

      // Ensure the range contains valid content before adding mark
      let validRange = false
      editor.state.doc.nodesBetween(match.from, match.to, node => {
        if (node.isText) {
          validRange = true
          return false
        }
        return true
      })

      if (!validRange) {
        continue
      }

      try {
        tr = tr.addMark(
          match.from,
          match.to,
          editor.schema.marks.dialogue.create({
            character: dialogue.character,
            conversationId: dialogue.uniqueConversationId,
            conversationName: dialogue.conversationName,
            userConfirmed: false,
          }),
        )
        marksApplied++
      } catch (error) {
        // Silently skip this mark if there's an error applying it
        console.error('Error applying dialogue mark:', error)
        continue
      }
    }
  }

  return { tr, marksApplied }
}

/**
 * Reapply confirmed marks to ensure they aren't lost during editing
 */
export function preserveConfirmedMarks(
  editor: Editor,
  confirmedRanges: ConfirmedMarkRange[],
  transaction: any,
): { tr: any; confirmedMarksPreserved: number } {
  let tr = transaction
  let confirmedMarksPreserved = 0

  confirmedRanges.forEach(range => {
    // Check if the mark still needs to be reapplied
    let needsReapply = true
    editor.state.doc.nodesBetween(range.from, range.to, (node: ProseMirrorNode, pos: number) => {
      if (pos === range.from && node.isText) {
        const existingMark = node.marks.find(m => m.type.name === 'dialogue')
        if (
          existingMark &&
          existingMark.attrs.userConfirmed &&
          existingMark.attrs.character === range.attrs.character &&
          existingMark.attrs.conversationId === range.attrs.conversationId
        ) {
          needsReapply = false
        }
      }
    })

    if (needsReapply) {
      tr = tr.addMark(
        range.from,
        range.to,
        editor.schema.marks.dialogue.create({
          ...range.attrs,
          userConfirmed: true,
        }),
      )
      confirmedMarksPreserved++
    }
  })

  return { tr, confirmedMarksPreserved }
}

/**
 * Process and extract dialogue marks from a document
 */
export interface ProcessedDialogueMark {
  id: string
  character: string
  content: string
  conversationId: string | null
  conversationName: string | null
  userConfirmed?: boolean
}

export function processDialogueMarks(doc: ProseMirrorNode): ProcessedDialogueMark[] {
  if (!doc) return []

  const marks: ProcessedDialogueMark[] = []
  let currentGroup: ProcessedDialogueMark | null = null

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text
      const nodeEndPos = pos + node.nodeSize
      const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')

      if (dialogueMark) {
        const markAttrs = dialogueMark.attrs as DialogueMark
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
          // Continue current group
          currentGroup.content += text
          const [start] = currentGroup.id.split('-').map(Number)
          currentGroup.id = `${start}-${nodeEndPos}`
          if (markInfo.userConfirmed) {
            currentGroup.userConfirmed = true
          }
        } else {
          // Start new group
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
        // End current group if exists
        if (currentGroup) {
          marks.push(currentGroup)
          currentGroup = null
        }
      }
      return true
    } else {
      // End current group if exists
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

  return marks.filter(mark => mark.content.trim().length > 0)
}

export interface GroupedDialogue {
  conversationId: string
  conversationName: string | null
  dialogues: ProcessedDialogueMark[]
}

/**
 * Group dialogue marks by conversation
 */
export function groupDialogueMarks(processedMarks: ProcessedDialogueMark[]): GroupedDialogue[] {
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

  return Object.entries(groups)
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
}

/**
 * Get the display part of a conversation ID
 */
export function getBaseConversationDisplay(uniqueId: string | null): string {
  if (!uniqueId || uniqueId === 'unknown') {
    return 'Unknown'
  }
  const parts = uniqueId.split('-')
  const lastPart = parts[parts.length - 1]

  // Check if we have a compound part with "conv-" prefix (e.g., conv-99)
  if (parts.length > 2 && parts[parts.length - 2] === 'conv') {
    return `conv-${lastPart}`
  }

  if (lastPart === 'conv') {
    return 'conv'
  }

  if (lastPart.startsWith('conv')) {
    return lastPart.substring(4) // Remove 'conv'
  }

  return lastPart // Fallback if format is unexpected
}
