'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { DocumentData } from '../types/globals'
import { useEffect, useRef, useState } from 'react'
import Footer from './footer'
import { useMouse } from '../components/providers'
import { useEditorFades } from './header'
import FindPanel from './find-panel'
import { SearchHighlight } from '../lib/tiptap-extensions/search-highlight'
import { DiffHighlight } from '../lib/tiptap-extensions/diff-highlight'
import { DialogueMark } from '../lib/tiptap-extensions/dialogue-mark'
import { DialogueHighlight } from '../lib/tiptap-extensions/dialogue-highlight'
import { DialogueFocus } from '../lib/tiptap-extensions/dialogue-focus'

// Add styles to override ProseMirror defaults
const editorStyles = `
  .ProseMirror {
    outline: none !important;
  }
  .ProseMirror-focused {
    outline: none !important;
  }
  .search-result {
    background-color: rgb(254 249 195); /* bg-yellow-100 */
  }
  .search-result-current {
    background-color: rgb(253 224 71); /* bg-yellow-300 */
  }
  .diff-added {
    background-color: rgba(134, 239, 172, 0.25); /* green-300 with opacity */
  }
  .diff-removed {
    background-color: rgba(252, 165, 165, 0.25); /* red-300 with opacity */
  }
  .dialogue-mark {
    /* Base class - no styling */
  }
  .dialogue-mark-active {
    background-color: rgba(147, 197, 253, 0.25); /* blue-300 with opacity */
    border-bottom: 1px solid rgba(147, 197, 253, 0.5);
  }
  .dialogue-dimmed {
    opacity: 0.5; /* Adjust opacity as needed */
    transition: opacity 0.3s ease-in-out; /* Add a smooth transition */
  }
`

type EditorProps = {
  id?: string
  content: DocumentData['content']
  title: string
  onUpdate: (data: Partial<DocumentData>) => void
  canEdit?: boolean
  hideFooter?: boolean
  hideTitle?: boolean
  shouldFocusTitle?: boolean
  diffMode?: boolean
  onEditorReady?: (editor: any) => void
  initialFocusConversationId?: string | null
}

const DEFAULT_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [],
    },
  ],
}

const EditorComponent = ({
  content,
  title,
  onUpdate,
  canEdit,
  hideFooter,
  hideTitle,
  shouldFocusTitle,
  diffMode,
  onEditorReady,
  initialFocusConversationId,
}: EditorProps) => {
  const [inputValue, setInputValue] = useState(title === 'Untitled' ? '' : title)
  const [showFindPanel, setShowFindPanel] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { mouseMoved } = useMouse()
  const [initFadeIn, fadeOut] = useEditorFades(!mouseMoved)

  // Update inputValue when title prop changes
  useEffect(() => {
    setInputValue(title === 'Untitled' ? '' : title)
  }, [title])

  // Parse the content JSON string or use default content
  const initialContent = (() => {
    try {
      // Handle both string and object content
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      return parsed
    } catch (e) {
      console.error('Failed to parse editor content:', e)
      console.log('Content that failed to parse:', content)
      return DEFAULT_CONTENT
    }
  })()

  const editor = useEditor({
    extensions: [StarterKit, SearchHighlight, DiffHighlight, DialogueMark, DialogueHighlight, DialogueFocus],
    content: initialContent,
    editable: canEdit && !diffMode,
    onUpdate: ({ editor }) => {
      if (diffMode) return // Prevent updates in diff mode
      const json = editor.getJSON()
      onUpdate({
        content: JSON.stringify(json),
        title: inputValue || 'Untitled',
      })
    },
    onCreate: ({ editor }) => {
      if (onEditorReady) {
        onEditorReady(editor)
      }
      // Set initial focus if ID is provided
      if (initialFocusConversationId) {
        editor.commands.setDialogueFocus(initialFocusConversationId)
      }
    },
  })

  // Track content prop changes
  useEffect(() => {
    if (editor && content) {
      const newContent = typeof content === 'string' ? JSON.parse(content) : content
      editor.commands.setContent(newContent)
    }
  }, [content, editor])

  // Only focus once on mount for new documents
  useEffect(() => {
    if (shouldFocusTitle || title === 'Untitled') {
      titleRef?.current?.focus()
      if (titleRef.current) {
        titleRef.current.selectionStart = titleRef.current.selectionEnd = titleRef.current.value.length
      }
    }
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger inline search if Command+F is pressed WITHOUT shift
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setShowFindPanel(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (shouldFocusTitle) {
      titleRef.current?.focus()
    }
  }, [shouldFocusTitle])

  return (
    <div className="flex h-full min-h-screen w-full animate-fadein flex-col overflow-x-hidden normal-case">
      <style>{editorStyles}</style>
      <div className="flex w-full justify-center">
        <div className="w-full max-w-[740px] px-4 pt-[44px]">
          {!hideTitle && (
            <textarea
              rows={1}
              ref={titleRef}
              value={inputValue}
              placeholder="Untitled"
              className="editable block w-full resize-none overflow-hidden border-b border-transparent bg-transparent text-3xl uppercase [-webkit-appearance:none] [appearance:none] placeholder:text-black/[.3] focus:border-transparent focus:outline-none focus:ring-0 focus:ring-offset-0 active:outline-none md:text-4xl"
              style={{
                outline: 'none',
                boxShadow: 'none',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                lineHeight: '1.2',
                width: '100%',
                minWidth: '100%',
              }}
              spellCheck={false}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  editor?.commands.focus()
                }
              }}
              onChange={e => {
                const newValue = e.target.value
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px'
                setInputValue(newValue)
                onUpdate({ title: newValue || 'Untitled' })
              }}
            />
          )}
        </div>
      </div>
      <div className="flex w-full flex-1 justify-center">
        <div className="w-full max-w-[740px] px-4">
          <div ref={containerRef} className="prose w-full max-w-none">
            <EditorContent
              editor={editor}
              className="h-full min-h-[calc(100vh-200px)] w-[692px] rounded-md px-4 pb-4 text-[19px] focus:outline-none focus:ring-0 md:text-[22px] [&_*]:focus:outline-none [&_*]:focus:ring-0"
            />
          </div>
        </div>
      </div>
      {showFindPanel && editor && <FindPanel editor={editor} onClose={() => setShowFindPanel(false)} />}
      {!hideFooter && <Footer editor={editor} initFadeIn={initFadeIn} fadeOut={fadeOut} />}
    </div>
  )
}

export default EditorComponent
