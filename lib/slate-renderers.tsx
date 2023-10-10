import { BaseEditor } from "slate"
import { ReactEditor } from "slate-react"

export type HighlightColor = 'red' | 'orange' | 'green' | 'blue' | 'pending' | 'comment'
export type DefaultText = { text: string, highlight?: HighlightColor, commentId?: string }
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
  attributes: Object
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
  attributes: Object
  leaf: DefaultText
  children: React.ReactNode
  openCommentId: string
}

type ColorMap = Record<HighlightColor, string>

const Leaf = ({ attributes, leaf, children, openCommentId }: RenderLeafProps) => {
  let highlight = ''

  const colorMap: ColorMap = {
    blue: 'bg-blue-200',
    green: 'bg-green-200',
    orange: 'bg-orange-200',
    red: 'bg-red-200',
    pending: 'bg-slate-200',
    comment: `${openCommentId === leaf.commentId ? 'bg-orange-300' : 'bg-orange-200' } hover:bg-orange-300`
  }

  if (leaf.highlight) {
    highlight = colorMap[leaf.highlight]
  }
  
  return (
    <span {...attributes} className={`transition duration-500 ${highlight}`}>
      {children}
    </span>
  )
}

export const renderLeaf = (props: any) => {
  return <Leaf {...props} />
}