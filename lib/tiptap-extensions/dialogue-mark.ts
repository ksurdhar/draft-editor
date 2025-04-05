import { Mark, mergeAttributes } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'

export interface DialogueMarkOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogue: {
      setDialogueMark: (attrs: {
        character: string
        conversationId: string
        conversationName?: string
        userConfirmed?: boolean
      }) => ReturnType
      unsetDialogueMark: () => ReturnType
      updateConversationName: (conversationId: string, newName: string) => ReturnType
    }
  }
}

export const DialogueMark = Mark.create<DialogueMarkOptions>({
  name: 'dialogue',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      character: {
        default: null,
        rendered: true,
        parseHTML: element => element.getAttribute('data-character'),
        renderHTML: attributes => {
          if (!attributes.character) {
            return {}
          }

          return {
            'data-character': attributes.character,
          }
        },
      },
      conversationId: {
        default: null,
        rendered: true,
        parseHTML: element => element.getAttribute('data-conversation-id'),
        renderHTML: attributes => {
          if (!attributes.conversationId) {
            return {}
          }

          return {
            'data-conversation-id': attributes.conversationId,
          }
        },
      },
      conversationName: {
        default: null,
        rendered: true,
        parseHTML: element => element.getAttribute('data-conversation-name'),
        renderHTML: attributes => {
          if (!attributes.conversationName) {
            return {}
          }
          return {
            'data-conversation-name': attributes.conversationName,
          }
        },
      },
      userConfirmed: {
        default: false,
        rendered: true,
        parseHTML: element => element.getAttribute('data-user-confirmed') === 'true',
        renderHTML: attributes => {
          if (!attributes.userConfirmed) {
            return {}
          }
          return {
            'data-user-confirmed': 'true',
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-character][data-conversation-id]',
        getAttrs: element => {
          if (typeof element === 'string') {
            return false
          }
          const character = element.getAttribute('data-character')
          const conversationId = element.getAttribute('data-conversation-id')
          const userConfirmed = element.getAttribute('data-user-confirmed') === 'true'
          const conversationName = element.getAttribute('data-conversation-name')

          if (!character || !conversationId) {
            return false
          }

          return {
            character,
            conversationId,
            conversationName,
            userConfirmed,
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const renderAttributes: Record<string, any> = {
      ...this.options.HTMLAttributes,
      ...HTMLAttributes,
      'data-character': HTMLAttributes.character,
      'data-conversation-id': HTMLAttributes.conversationId,
      class: 'dialogue-mark',
    }

    if (HTMLAttributes.conversationName) {
      renderAttributes['data-conversation-name'] = HTMLAttributes.conversationName
    }
    if (HTMLAttributes.userConfirmed) {
      renderAttributes['data-user-confirmed'] = 'true'
    }

    return ['span', mergeAttributes(renderAttributes), 0]
  },

  addCommands() {
    return {
      setDialogueMark:
        attrs =>
        ({ commands }) => {
          return commands.setMark(this.name, attrs)
        },
      unsetDialogueMark:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
      updateConversationName:
        (conversationId, newName) =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          let modified = false
          const { doc } = state
          const markType = state.schema.marks[this.name]

          doc.descendants((node: Node, pos: number) => {
            if (!node.isText) return true

            const marks = node.marks.filter(mark => mark.type === markType)
            marks.forEach(mark => {
              if (mark.attrs.conversationId === conversationId && mark.attrs.conversationName !== newName) {
                const newAttrs = { ...mark.attrs, conversationName: newName }
                tr.addMark(pos, pos + node.nodeSize, markType.create(newAttrs))
                modified = true
              }
            })
            return true
          })

          if (modified) {
            dispatch(tr)
          }

          return modified
        },
    }
  },
})
