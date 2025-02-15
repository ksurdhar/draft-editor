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
`

type EditorProps = {
  id?: string
  content: DocumentData['content']
  title: string
  onUpdate: (data: Partial<DocumentData>) => void
  canEdit?: boolean
  hideFooter?: boolean
  shouldFocusTitle?: boolean
}

const DEFAULT_CONTENT = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: []
    }
  ]
}

const EditorComponent = ({ 
  content, 
  title, 
  onUpdate, 
  canEdit, 
  hideFooter, 
  shouldFocusTitle 
}: EditorProps) => {
  const [inputValue, setInputValue] = useState(title === 'Untitled' ? '' : title)
  const [showFindPanel, setShowFindPanel] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { mouseMoved } = useMouse()
  const [initFadeIn, fadeOut] = useEditorFades(!mouseMoved)

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
    extensions: [
      StarterKit,
      SearchHighlight,
    ],
    content: initialContent,
    editable: canEdit,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      console.log('Editor onUpdate triggered - new content:', json)
      onUpdate({ content: json })
    },
    onCreate: ({ editor }) => {
      console.log('Editor onCreate - initial content:', editor.getJSON())
    }
  })

  // Track content prop changes
  useEffect(() => {
    console.log('Editor content prop changed:', {
      newContent: content,
      parsed: typeof content === 'string' ? JSON.parse(content) : content,
      currentEditorContent: editor?.getJSON()
    })

    if (editor && content) {
      const newContent = typeof content === 'string' ? JSON.parse(content) : content
      console.log('Setting editor content to:', newContent)
      editor.commands.setContent(newContent)
      console.log('Editor content after update:', editor.getJSON())
    }
  }, [content, editor])

  // Track editor initialization
  useEffect(() => {
    if (editor) {
      console.log('Editor instance changed:', {
        content: editor.getJSON(),
        isEditable: editor.isEditable
      })
    }
  }, [editor])

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
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setShowFindPanel(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className='flex-grow normal-case animate-fadein'>
      <style>{editorStyles}</style>
      <div className='mb-[20px] mt-[44px]'>
        <input
          type="text"
          ref={titleRef}
          value={inputValue}
          placeholder='Untitled'
          className="editable mb-2 text-3xl md:text-4xl uppercase border-b border-transparent focus:outline-none active:outline-none focus:ring-0 focus:ring-offset-0 focus:border-transparent w-full bg-transparent placeholder:text-black/[.3] [appearance:none] [-webkit-appearance:none]"
          style={{ outline: 'none', boxShadow: 'none' }}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              editor?.commands.focus()
            }
          }}
          onChange={(e) => {
            const newValue = e.target.value
            setInputValue(newValue)
            onUpdate({ title: newValue || 'Untitled' })
          }}
        />
      </div>
      <div ref={containerRef} className="prose max-w-none">
        <EditorContent 
          editor={editor} 
          className='rounded-md w-full h-full static text-[19px] md:text-[22px] focus:outline-none focus:ring-0 [&_*]:focus:outline-none [&_*]:focus:ring-0 min-h-[200px] p-4'
        />
      </div>
      {showFindPanel && editor && (
        <FindPanel 
          editor={editor} 
          onClose={() => setShowFindPanel(false)}
        />
      )}
      {!hideFooter && (
        <Footer 
          editor={editor}
          initFadeIn={initFadeIn} 
          fadeOut={fadeOut} 
        />
      )}
    </div>
  )
}

export default EditorComponent
