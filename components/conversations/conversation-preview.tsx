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
import { Input } from '@components/ui/input' // Add Input for editing name
import { CheckIcon, XIcon } from 'lucide-react' // Icons for save/cancel

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
  isEditing: boolean
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>
  onUpdateConversationName: (conversationId: string, newName: string) => Promise<void> // Added prop
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
const ConversationPreview: React.FC<ConversationPreviewProps> = ({
  conversation,
  isEditing,
  setIsEditing,
  onUpdateConversationName, // Destructure new prop
}) => {
  const { get, patch } = useAPI()
  const { navigateTo } = useNavigation() // Add navigation hook
  const [editorContent, setEditorContent] = useState<any>(null)
  const [isLoadingEditor, setIsLoadingEditor] = useState(false)
  const [currentConversationData, setCurrentConversationData] = useState<ConversationGroup | null>(
    conversation,
  )
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false) // State for name editing
  const [nameInputValue, setNameInputValue] = useState('') // State for name input value

  // Update local state if the conversation prop changes from parent
  useEffect(() => {
    if (conversation) {
      // Always update if the prop changes externally
      // Keep local editing state separate
      setCurrentConversationData(conversation)
      if (isEditingName && conversation.conversationId !== currentConversationData?.conversationId) {
        // If the conversation changes while editing name, cancel editing
        setIsEditingName(false)
      }
      if (!isEditingName) {
        setNameInputValue(conversation.conversationName || '')
      }
    } else {
      setCurrentConversationData(null)
      setIsEditingName(false)
    }
  }, [conversation, isEditingName, currentConversationData?.conversationId]) // Dependency on conversation

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
        // Also update the name in case it was changed elsewhere, but prioritize local edit
        const updatedName = currentConversationData.conversationName // Preserve potential local updates if needed
        setCurrentConversationData(prevData =>
          prevData ? { ...prevData, entries: updatedEntries, conversationName: updatedName } : null,
        )
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
  }, [isEditing, currentConversationData, get, refreshConversationView, setIsEditing])

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
      } catch (error) {
        console.error('Error saving document:', error)
      }
    },
    [currentConversationData, get, patch],
  )

  const debouncedSave = useMemo(() => debounce(handleSave, 1500), [handleSave])

  const handleNameDoubleClick = () => {
    if (currentConversationData && !isEditing) {
      // Only allow editing name when NOT in full editor mode
      setNameInputValue(currentConversationData.conversationName || '')
      setIsEditingName(true)
    }
  }

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNameInputValue(event.target.value)
  }

  const handleCancelNameEdit = () => {
    setIsEditingName(false)
    setNameInputValue(currentConversationData?.conversationName || '') // Reset to original
  }

  const handleSaveName = async () => {
    if (!currentConversationData || !isEditingName) return
    const newName = nameInputValue.trim()
    setIsEditingName(false) // Exit editing mode immediately

    // Optimistically update UI
    const previousName = currentConversationData.conversationName
    setCurrentConversationData(prev => (prev ? { ...prev, conversationName: newName } : null))

    try {
      await onUpdateConversationName(currentConversationData.conversationId, newName)
      // If successful, the parent state should update, and the prop change will confirm the update here.
      console.log('Conversation name updated successfully.')
    } catch (error) {
      console.error('Failed to update conversation name:', error)
      // Revert optimistic update on error
      setCurrentConversationData(prev => (prev ? { ...prev, conversationName: previousName } : null))
      // Maybe show an error message to the user
    }
  }

  const handleNameInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSaveName()
    } else if (event.key === 'Escape') {
      handleCancelNameEdit()
    }
  }

  if (!currentConversationData) {
    return (
      <Card className="flex h-full items-center justify-center bg-transparent backdrop-blur-none">
        <CardContent className="flex flex-col items-center justify-center">
          <Typography variant="body1" className="mb-2 text-center text-muted-foreground">
            Select a conversation to view its details.
          </Typography>
          <Typography variant="caption" className="max-w-md text-center text-muted-foreground/75">
            Choose a conversation from the list on the left to see the dialogue and participants here.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-full flex-col bg-transparent">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-card/90 backdrop-blur-lg">
        <div
          className="mr-4 min-w-0 flex-grow" // Allow title area to grow and shrink
          onDoubleClick={handleNameDoubleClick}
          title={!isEditing ? 'Double-click to rename conversation' : ''}>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={nameInputValue}
                onChange={handleNameChange}
                onKeyDown={handleNameInputKeyDown}
                // onBlur={handleCancelNameEdit} // Prefer explicit cancel/save
                placeholder="Conversation Name"
                className="h-8 text-lg" // Match size approximately
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveName}>
                <CheckIcon className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelNameEdit}>
                <XIcon className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <CardTitle className="cursor-pointer truncate text-xl">
              {currentConversationData?.conversationName || 'Unnamed Conversation'}
            </CardTitle>
          )}
          <Typography
            variant="caption"
            className="cursor-pointer truncate text-muted-foreground/75 hover:text-muted-foreground hover:underline"
            onClick={() => !isEditingName && navigateTo(`/documents/${currentConversationData?.documentId}`)}>
            From: {currentConversationData?.documentTitle}
          </Typography>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleEdit}
          disabled={isLoadingEditor || isEditingName} // Disable edit toggle when editing name
        >
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
          <div className="read-only-conversation mx-auto w-full max-w-2xl space-y-4 p-6 font-editor2 text-[18px]">
            {currentConversationData.entries.length > 0 ? (
              currentConversationData.entries.map((entry, entryIndex) => (
                <div key={entryIndex} className="dialogue-line">
                  <span className="character-name mr-1 font-bold text-black">{entry.characterName}:</span>
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
