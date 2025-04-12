'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card'
import { Button } from '@components/ui/button' // Add Button for toggle
import { Typography } from '@mui/material'
import TiptapJsonRenderer from '@components/tiptap-json-renderer'
import EditorComponent from '@components/editor' // Import Editor
import { useAPI, useNavigation } from '@components/providers' // Import API hook and useNavigation
import { Loader } from '@components/loader' // Import Loader
import { debounce } from '@lib/utils' // Import debounce
import { DocumentData } from '@typez/globals' // Import DocumentData type

// --- Type Definitions (Should match or be imported from a shared location) ---
interface TiptapMark {
  type: string
  attrs?: Record<string, any>
}
interface TiptapNode {
  type: string
  content?: TiptapNode[]
  text?: string
  marks?: TiptapMark[]
  attrs?: Record<string, any>
}
interface DialogueEntry {
  characterId: string
  characterName: string
  documentId?: string
  documentTitle?: string
  contentNode: TiptapNode
}
interface ConversationGroup {
  conversationId: string
  conversationName?: string | null
  documentId: string
  documentTitle: string
  entries: DialogueEntry[]
  lastUpdated?: number
}

// --- Component Props ---
interface ConversationPreviewProps {
  conversation: ConversationGroup | null
  // characterName: string // Removed - No longer needed
}

// --- Helper: Extract Specific Conversation Entries ---
const extractConversationEntries = (documentContent: any, targetConversationId: string): DialogueEntry[] => {
  const entries: DialogueEntry[] = []

  const processNode = (node: TiptapNode) => {
    if (node.type === 'text' && node.marks) {
      node.marks.forEach((mark: TiptapMark) => {
        if (
          mark.type === 'dialogue' &&
          mark.attrs?.conversationId === targetConversationId &&
          mark.attrs?.character &&
          node.text
        ) {
          const { character } = mark.attrs
          entries.push({
            characterId: character,
            characterName: character,
            contentNode: { ...node }, // Store the text node itself
          })
        }
      })
    }
    if (node.content && Array.isArray(node.content)) {
      node.content.forEach(processNode)
    }
  }

  let parsedContent = documentContent
  if (typeof documentContent === 'string') {
    try {
      parsedContent = JSON.parse(documentContent)
    } catch (e) {
      console.error('Failed to parse content in extractConversationEntries:', e)
      return []
    }
  }

  if (parsedContent && parsedContent.type === 'doc') {
    processNode(parsedContent)
  }

  return entries
}

// --- Helper: Extract Conversation Nodes (Re-added) ---
const extractConversationNodes = (fullContent: any, conversationId: string): any => {
  // Parse the content if it's a string
  let parsedContent = fullContent
  if (typeof fullContent === 'string') {
    try {
      parsedContent = JSON.parse(fullContent)
    } catch (e) {
      console.error('Failed to parse content in extractConversationNodes:', e)
      return { type: 'doc', content: [] }
    }
  }

  const paragraphsWithConversation = new Set<number>()
  const hasConversationMark = (node: any): boolean => {
    if (
      node.marks?.length &&
      node.marks.some(
        (mark: any) => mark.type === 'dialogue' && mark.attrs?.conversationId === conversationId,
      )
    ) {
      return true
    }
    return node.content?.length ? node.content.some(hasConversationMark) : false
  }

  if (parsedContent?.type === 'doc' && Array.isArray(parsedContent.content)) {
    parsedContent.content.forEach((paragraph: any, index: number) => {
      if (hasConversationMark(paragraph)) {
        paragraphsWithConversation.add(index)
      }
    })
  }

  if (paragraphsWithConversation.size === 0) {
    return { type: 'doc', content: [] }
  }

  const paragraphIndices = Array.from(paragraphsWithConversation).sort((a, b) => a - b)
  const minParagraphIndex = paragraphIndices[0]
  const maxParagraphIndex = paragraphIndices[paragraphIndices.length - 1]
  const extractedParagraphs = parsedContent.content.slice(minParagraphIndex, maxParagraphIndex + 1)

  return {
    type: 'doc',
    content: extractedParagraphs,
  }
}

// --- Helper: Merge Edited Section (Seems OK now) ---
const mergeEditedSection = (fullContent: any, editedSection: any, conversationId: string): any => {
  // ...(Same logic as before, ensure it handles string/object content)
  let parsedFullContent = fullContent
  let parsedEditedSection = editedSection

  if (typeof fullContent === 'string') {
    try {
      parsedFullContent = JSON.parse(fullContent)
    } catch (e) {
      return fullContent
    }
  }
  if (typeof editedSection === 'string') {
    try {
      parsedEditedSection = JSON.parse(editedSection)
    } catch (e) {
      return parsedFullContent
    }
  }

  const paragraphsWithConversation = new Set<number>()
  const hasConversationMark = (node: any): boolean => {
    if (
      node.marks?.length &&
      node.marks.some(
        (mark: any) => mark.type === 'dialogue' && mark.attrs?.conversationId === conversationId,
      )
    ) {
      return true
    }
    return node.content?.length ? node.content.some(hasConversationMark) : false
  }

  if (parsedFullContent?.type === 'doc' && Array.isArray(parsedFullContent.content)) {
    parsedFullContent.content.forEach((paragraph: any, index: number) => {
      if (hasConversationMark(paragraph)) {
        paragraphsWithConversation.add(index)
      }
    })
  }

  if (paragraphsWithConversation.size === 0) {
    return parsedFullContent
  }

  const paragraphIndices = Array.from(paragraphsWithConversation).sort((a, b) => a - b)
  const minParagraphIndex = paragraphIndices[0]
  const maxParagraphIndex = paragraphIndices[paragraphIndices.length - 1]

  const mergedContent = {
    ...parsedFullContent,
    content: [
      ...parsedFullContent.content.slice(0, minParagraphIndex),
      ...(parsedEditedSection.content || []),
      ...parsedFullContent.content.slice(maxParagraphIndex + 1),
    ],
  }
  return mergedContent
}

// --- Component ---
const ConversationPreview: React.FC<ConversationPreviewProps> = ({ conversation /*, characterName */ }) => {
  const { get, patch } = useAPI()
  const { navigateTo } = useNavigation() // Add navigation hook
  const [isEditing, setIsEditing] = useState(false)
  const [editorContent, setEditorContent] = useState<any>(null)
  const [isLoadingEditor, setIsLoadingEditor] = useState(false)
  // State to hold the potentially updated conversation data after save
  const [currentConversationData, setCurrentConversationData] = useState<ConversationGroup | null>(
    conversation,
  )
  // Add loading state for view mode refresh
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Update local state if the conversation prop changes from parent
  useEffect(() => {
    setCurrentConversationData(conversation)
    setIsEditing(false) // Reset edit mode if conversation changes
    setEditorContent(null)
  }, [conversation])

  const refreshConversationView = useCallback(async () => {
    if (!currentConversationData) return
    setIsLoadingPreview(true)
    try {
      const updatedDocument = await get(`/documents/${currentConversationData.documentId}`)
      if (updatedDocument && updatedDocument.content) {
        const updatedEntries = extractConversationEntries(
          updatedDocument.content,
          currentConversationData.conversationId,
        )
        setCurrentConversationData(prevData => (prevData ? { ...prevData, entries: updatedEntries } : null))
        console.log('Conversation view refreshed.')
      } else {
        console.error('Failed to fetch updated document content for view refresh.')
      }
    } catch (error) {
      console.error('Error refreshing conversation view:', error)
    } finally {
      setIsLoadingPreview(false)
    }
  }, [get, currentConversationData])

  const handleToggleEdit = useCallback(async () => {
    if (!currentConversationData) return

    if (isEditing) {
      // Switching from Edit to View
      setIsEditing(false)
      setEditorContent(null)
      refreshConversationView()
    } else {
      // Switching from View to Edit
      setIsLoadingEditor(true)
      setIsEditing(true)
      try {
        const fullDocument = await get(`/documents/${currentConversationData.documentId}`)
        if (fullDocument && fullDocument.content) {
          const extractedContent = extractConversationNodes(
            fullDocument.content,
            currentConversationData.conversationId,
          )
          setEditorContent(extractedContent)
        } else {
          console.error('Failed to fetch document content for editing.')
          setEditorContent({ type: 'doc', content: [] }) // Set empty doc on error
        }
      } catch (error) {
        console.error('Error fetching document for editing:', error)
        setEditorContent({ type: 'doc', content: [] })
      } finally {
        setIsLoadingEditor(false)
      }
    }
  }, [isEditing, currentConversationData, get, refreshConversationView])

  const handleSave = useCallback(
    async (updatedData: Partial<DocumentData>) => {
      const updatedEditorContent = updatedData.content
      if (!currentConversationData || !updatedEditorContent) {
        console.error('Cannot save: Missing data.')
        return
      }

      try {
        const fullDocument = await get(`/documents/${currentConversationData.documentId}`)
        if (!fullDocument) {
          console.error('Failed to fetch full document for merging edits.')
          return
        }

        const mergedContent = mergeEditedSection(
          fullDocument.content,
          updatedEditorContent,
          currentConversationData.conversationId,
        )

        const patchData: Partial<DocumentData> = {
          content: JSON.stringify(mergedContent),
          lastUpdated: Date.now(),
        }
        await patch(`/documents/${currentConversationData.documentId}`, patchData)
        console.log(`Document ${currentConversationData.documentId} saved successfully.`)

        setEditorContent(updatedEditorContent)
      } catch (error) {
        console.error('Error saving document:', error)
      }
    },
    [currentConversationData, get, patch],
  )

  const debouncedSave = useMemo(() => debounce(handleSave, 1500), [handleSave])

  if (!currentConversationData) {
    return (
      <Card className="flex h-full items-center justify-center">
        <CardContent>
          <Typography variant="body2" className="text-muted-foreground">
            Select a conversation to view its details.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Conversation: {currentConversationData.conversationId}</CardTitle>
          <Typography
            variant="caption"
            className="cursor-pointer text-muted-foreground/75 hover:text-muted-foreground hover:underline"
            onClick={() => navigateTo(`/documents/${currentConversationData.documentId}`)}>
            From: {currentConversationData.documentTitle}
          </Typography>
        </div>
        <Button variant="outline" size="sm" onClick={handleToggleEdit} disabled={isLoadingEditor}>
          {isLoadingEditor ? <Loader /> : isEditing ? 'View' : 'Edit'}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        {isLoadingPreview ? ( // Show loader while refreshing view
          <div className="flex h-full items-center justify-center">
            <Loader />
          </div>
        ) : isEditing ? (
          isLoadingEditor ? (
            <div className="flex h-full items-center justify-center">
              <Loader />
            </div>
          ) : editorContent ? (
            <div className="h-full flex-1 overflow-y-auto p-4">
              <EditorComponent
                key={`${currentConversationData.documentId}-${currentConversationData.conversationId}-editor`}
                content={editorContent || ''}
                title={``}
                canEdit={true}
                hideFooter={true}
                hideTitle={true}
                onUpdate={debouncedSave}
                isDialogueMode={true}
                onEditorReady={editor => {
                  if (editor) {
                    editor.commands.setDialogueHighlight(true)
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Typography variant="body2" className="text-destructive">
                Could not load editor content.
              </Typography>
            </div>
          )
        ) : (
          <div className="read-only-conversation prose w-full max-w-none space-y-2 font-editor2 text-[18px] dark:prose-invert">
            {currentConversationData.entries.length > 0 ? (
              currentConversationData.entries.map((entry, entryIndex) => (
                <div key={entryIndex} className="dialogue-line">
                  <span className="character-name mr-1 font-semibold text-black/[.65]">
                    {entry.characterName}:
                  </span>
                  <TiptapJsonRenderer node={entry.contentNode} className="inline" />
                </div>
              ))
            ) : (
              <Typography variant="body2" className="text-muted-foreground">
                This conversation appears empty after the edit.
              </Typography>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ConversationPreview
