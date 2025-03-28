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
        ({ tr, dispatch }) => {
          if (dispatch) {
            // Store the active flag in the plugin meta
            tr.setMeta(dialogueHighlightPluginKey, { active })
          }
          return true
        },
      unsetDialogueHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(dialogueHighlightPluginKey, { active: false })
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const self = this
    return [
      new Plugin({
        key: dialogueHighlightPluginKey,
        state: {
          init() {
            return { active: false }
          },
          apply(tr, value) {
            const meta = tr.getMeta(dialogueHighlightPluginKey)
            if (meta && typeof meta.active === 'boolean') {
              return { active: meta.active }
            }
            return value
          },
        },
        props: {
          decorations(state) {
            const pluginState = this.getState(state)
            // Only compute decorations if dialogue highlighting is active
            if (!pluginState.active) {
              return DecorationSet.empty
            }

            const decorations: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.marks.some(mark => mark.type.name === 'dialogue')) {
                decorations.push(
                  Decoration.inline(pos, pos + node.nodeSize, {
                    class: self.options.highlightClass,
                  }),
                )
              }
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
