import { Mark, mergeAttributes } from '@tiptap/core'

export interface DialogueMarkOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogue: {
      setDialogueMark: (attrs: { character: string; conversationId: string }) => ReturnType
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
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-character]',
        getAttrs: element => {
          if (typeof element === 'string') {
            return false
          }
          return {
            character: element.getAttribute('data-character'),
            conversationId: element.getAttribute('data-conversation-id'),
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        this.options.HTMLAttributes,
        HTMLAttributes,
        {
          'data-character': HTMLAttributes.character,
          'data-conversation-id': HTMLAttributes.conversationId,
        },
        {
          class: 'dialogue-mark',
        },
      ),
      0,
    ]
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
