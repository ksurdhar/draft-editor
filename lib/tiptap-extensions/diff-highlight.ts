import { Mark, mergeAttributes } from '@tiptap/core'

export interface DiffHighlightOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    diffHighlight: {
      setDiffHighlight: (type: 'added' | 'removed') => ReturnType
      unsetDiffHighlight: () => ReturnType
    }
  }
}

export const DiffHighlight = Mark.create<DiffHighlightOptions>({
  name: 'diffHighlight',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      type: {
        default: null,
        rendered: true,
        parseHTML: element => element.getAttribute('data-diff-type'),
        renderHTML: attributes => {
          if (!attributes.type) {
            return {}
          }

          return {
            'data-diff-type': attributes.type,
            'class': `diff-${attributes.type}`
          }
        }
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-diff-type]',
        getAttrs: element => {
          if (typeof element === 'string') {
            return false
          }
          return {
            type: element.getAttribute('data-diff-type'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(
      this.options.HTMLAttributes,
      HTMLAttributes,
      { 'data-diff-type': HTMLAttributes.type },
      { class: `diff-${HTMLAttributes.type}` }
    ), 0]
  },

  addCommands() {
    return {
      setDiffHighlight:
        (type: 'added' | 'removed') =>
        ({ commands }) => {
          return commands.setMark(this.name, { type })
        },
      unsetDiffHighlight:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
}) 