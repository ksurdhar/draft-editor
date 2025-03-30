import { Mark, mergeAttributes } from '@tiptap/core'

export interface DialogueMarkOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogue: {
      setDialogueMark: (attrs: {
        character: string
        conversationId: string
        userConfirmed?: boolean
      }) => ReturnType
      unsetDialogueMark: () => ReturnType
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

          if (!character || !conversationId) {
            return false
          }

          return {
            character,
            conversationId,
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
    }
  },
})
