'use client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { DocumentData } from '../types/globals'
import { useEffect, useRef, useState } from 'react'
import Footer from './footer'
import { useMouse } from '../components/providers'
import { useEditorFades } from './header'

// Add styles to override ProseMirror defaults
const editorStyles = `
  .ProseMirror {
    outline: none !important;
  }
  .ProseMirror-focused {
    outline: none !important;
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
  const titleRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { mouseMoved } = useMouse()
  const [initFadeIn, fadeOut] = useEditorFades(!mouseMoved)

  // Parse the content JSON string or use default content
  const initialContent = (() => {
    try {
      console.log('Raw content received:', content)
      // Handle both string and object content
      const parsed = typeof content === 'string' ? JSON.parse(content) : content
      console.log('Parsed content:', parsed)
      return parsed
    } catch (e) {
      console.error('Failed to parse editor content:', e)
      console.log('Content that failed to parse:', content)
      return DEFAULT_CONTENT
    }
  })()

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editable: canEdit,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      console.log('Editor update - new content:', json)
      onUpdate({ content: { type: 'doc', content: json.content || [] } })
    },
    onCreate: ({ editor }) => {
      console.log('Editor created with content:', editor.getJSON())
      console.log('Editor HTML:', editor.getHTML())
    }
  })

  useEffect(() => {
    console.log('Editor mounted with content:', editor?.getJSON());
  }, [editor]);

  // Only focus once on mount for new documents
  useEffect(() => {
    if (shouldFocusTitle || title === 'Untitled') {
      titleRef?.current?.focus()
      if (titleRef.current) {
        titleRef.current.selectionStart = titleRef.current.selectionEnd = titleRef.current.value.length
      }
    }
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
      {!hideFooter && (
        <Footer 
          initFadeIn={initFadeIn} 
          fadeOut={fadeOut} 
          wordCount={0} // We'll implement word count later
          wordCountAtPos={0} 
        />
      )}
    </div>
  )
}

export default EditorComponent
