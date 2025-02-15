import { BaseEditor } from "slate"
import { ReactEditor } from "slate-react"
import React from 'react'
import styled from '@emotion/styled'

export type HighlightColor = 'red' | 'orange' | 'green' | 'blue' | 'pending' | 'comment' | 'none'
export type DefaultText = { 
  text: string
  highlight?: HighlightColor
  commentId?: string
  isCurrentMatch?: boolean
}

type DefaultElement = { type: 'default'; children: DefaultText[] }
type CustomElement = DefaultElement 

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor
    Element: CustomElement
    Text: DefaultText
  }
}

type RenderElementProps = {
  attributes: Record<string, unknown>
  element: CustomElement
  children: React.ReactNode
}

const BodyElement = ({ attributes, children} : RenderElementProps) => {
  return (
    <div {...attributes}>
      <div className='transition'>{children}</div>
    </div>
  )
}

export const renderElement = (props: RenderElementProps) => {
  switch (props.element.type) {
    default:
      return <BodyElement {...props} />
  }
}

type RenderLeafProps = {
  attributes: Record<string, unknown>
  leaf: DefaultText
  children: React.ReactNode
  openCommentId?: string
}

const HighlightedSpan = styled.span<{ highlight?: HighlightColor }>`
  transition: background-color 100ms ease;
  ${props => {
    switch (props.highlight) {
      case 'green':
        return 'background-color: rgb(187 247 208);' // bg-green-200 equivalent
      case 'orange':
        return 'background-color: rgb(254 215 170);' // bg-orange-200 equivalent
      case 'red':
        return 'background-color: rgb(254 202 202);' // bg-red-200 equivalent
      case 'blue':
        return 'background-color: rgb(253 224 71);' // bg-yellow-300 equivalent
      case 'pending':
        return 'background-color: rgb(254 249 195);' // bg-yellow-100 equivalent
      default:
        return ''
    }
  }}
`

export const renderLeaf = (props: RenderLeafProps) => {
  const { attributes, children, leaf } = props
  console.log('=== Rendering leaf ===')
  console.log('Text:', leaf.text)
  console.log('Highlight:', leaf.highlight)
  console.log('Props:', props)

  console.log('=== End rendering leaf ===\n')
  return (
    <HighlightedSpan {...attributes} highlight={leaf.highlight}>
      {children}
    </HighlightedSpan>
  )
}