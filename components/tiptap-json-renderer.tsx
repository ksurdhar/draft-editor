import React from 'react'

// Basic type definitions for Tiptap JSON structure
// Extend these as needed for more complex nodes/marks
interface Mark {
  type: string
  attrs?: Record<string, any>
}

interface Node {
  type: string
  content?: Node[]
  text?: string
  marks?: Mark[]
  attrs?: Record<string, any>
}

interface TiptapJsonRendererProps {
  node: Node | Node[] // Accept a single node or an array of nodes
  className?: string // Optional className for the root element
}

// Helper function to apply marks to text content
const applyMarks = (text: string, marks: Mark[]): React.ReactNode => {
  let content: React.ReactNode = text

  marks.forEach(mark => {
    switch (mark.type) {
      case 'bold':
        content = <strong>{content}</strong>
        break
      case 'italic':
        content = <em>{content}</em>
        break
      case 'strike':
        content = <s>{content}</s>
        break
      case 'dialogue':
        // Apply the base class used in editor.tsx for visual consistency
        // You might add logic for 'dialogue-mark-active' based on props if needed later
        content = <span className="dialogue-mark">{content}</span>
        break
      // Add cases for other marks as needed (e.g., link, code)
      default:
        break
    }
  })

  return content
}

// Recursive function to render a single Tiptap node
const renderNode = (node: Node): React.ReactNode => {
  switch (node.type) {
    case 'doc':
      // Render container for children
      return (
        <>
          {node.content?.map((childNode, index) => (
            <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
          ))}
        </>
      )

    case 'paragraph':
      return (
        <p>
          {node.content?.map((childNode, index) => (
            <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
          )) ?? node.text}
        </p>
      )

    case 'text':
      if (node.marks && node.marks.length > 0) {
        return applyMarks(node.text || '', node.marks)
      }
      return node.text || ''

    case 'heading':
      const Tag = `h${node.attrs?.level || 1}` as keyof JSX.IntrinsicElements
      return (
        <Tag>
          {node.content?.map((childNode, index) => (
            <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
          )) ?? node.text}
        </Tag>
      )

    case 'bulletList':
      return (
        <ul>
          {node.content?.map((childNode, index) => (
            <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
          ))}
        </ul>
      )

    case 'orderedList':
      return (
        <ol>
          {node.content?.map((childNode, index) => (
            <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
          ))}
        </ol>
      )

    case 'listItem':
      return (
        <li>
          {node.content?.map((childNode, index) => (
            <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
          )) ?? node.text}
        </li>
      )

    case 'blockquote':
      return (
        <blockquote>
          {node.content?.map((childNode, index) => (
            <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
          )) ?? node.text}
        </blockquote>
      )

    case 'codeBlock':
      return (
        <pre>
          <code>
            {node.content?.map((childNode, index) => (
              <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
            )) ?? node.text}
          </code>
        </pre>
      )

    case 'hardBreak':
      return <br />

    case 'horizontalRule':
      return <hr />

    // Add cases for other Tiptap node types as needed

    default:
      console.warn('Unsupported Tiptap node type:', node.type)
      // Fallback: render text content if available
      return (
        node.text ||
        node.content?.map((childNode, index) => (
          <React.Fragment key={index}>{renderNode(childNode)}</React.Fragment>
        )) ||
        null
      )
  }
}

const TiptapJsonRenderer: React.FC<TiptapJsonRendererProps> = ({ node, className }) => {
  // Mimic ProseMirror/editor styling for consistency
  // Use prose classes for basic typography similar to the editor
  // Keep `tiptap-render-output` for potential specific overrides
  return (
    <div className={`tiptap-render-output prose prose-sm max-w-none ${className || ''}`}>
      {Array.isArray(node)
        ? node.map((n, index) => <React.Fragment key={index}>{renderNode(n)}</React.Fragment>)
        : renderNode(node)}
    </div>
  )
}

export default TiptapJsonRenderer
