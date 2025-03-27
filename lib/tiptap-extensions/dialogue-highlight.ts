import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface DialogueHighlightOptions {
  highlightClass: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogueHighlight: {
      setDialogueHighlight: (active: boolean) => ReturnType
      unsetDialogueHighlight: () => ReturnType
    }
  }
}

export const dialogueHighlightPluginKey = new PluginKey('dialogue-highlight')

export const DialogueHighlight = Extension.create<DialogueHighlightOptions>({
  name: 'dialogueHighlight',

  addOptions() {
    return {
      highlightClass: 'dialogue-mark-active',
    }
  },

  addCommands() {
    return {
      setDialogueHighlight:
        active =>
        ({ tr, state, dispatch }) => {
          if (dispatch) {
            // Find all dialogue marks in the document
            const decorations: any[] = []
            state.doc.descendants((node, pos) => {
              const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')
              if (dialogueMark) {
                decorations.push(
                  Decoration.inline(pos, pos + node.nodeSize, {
                    class: active ? this.options.highlightClass : '',
                  }),
                )
              }
            })

            const decos = DecorationSet.create(tr.doc, decorations)
            tr.setMeta(dialogueHighlightPluginKey, { decorations: decos })
          }
          return true
        },
      unsetDialogueHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(dialogueHighlightPluginKey, { decorations: DecorationSet.empty })
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const key = dialogueHighlightPluginKey
    return [
      new Plugin({
        key,
        state: {
          init() {
            return { decorations: DecorationSet.empty }
          },
          apply(tr, value) {
            const meta = tr.getMeta(key)
            if (meta) {
              return meta
            }
            if (tr.docChanged) {
              return { decorations: value.decorations.map(tr.mapping, tr.doc) }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            const pluginState = this.getState(state)
            return pluginState?.decorations || DecorationSet.empty
          },
        },
      }),
    ]
  },
})
