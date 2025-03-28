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
        ({ tr, dispatch, state }) => {
          if (dispatch) {
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
            // Set the meta with a custom flag (keepHighlight) to control remapping
            tr.setMeta(dialogueHighlightPluginKey, { decorations: decos, keepHighlight: active })
          }
          return true
        },
      unsetDialogueHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(dialogueHighlightPluginKey, {
              decorations: DecorationSet.empty,
              keepHighlight: false,
            })
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
            return { decorations: DecorationSet.empty, keepHighlight: false }
          },
          apply(tr, value) {
            const meta = tr.getMeta(dialogueHighlightPluginKey)
            if (meta) {
              return meta
            }
            if (tr.docChanged && !value.keepHighlight) {
              return { decorations: value.decorations.map(tr.mapping, tr.doc), keepHighlight: false }
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
