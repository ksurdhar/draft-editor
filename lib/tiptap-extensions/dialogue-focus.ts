'use client'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface DialogueFocusOptions {
  dimmedClass: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogueFocus: {
      setDialogueFocus: (conversationId: string | null) => ReturnType
      unsetDialogueFocus: () => ReturnType
    }
  }
}

export const dialogueFocusPluginKey = new PluginKey('dialogue-focus')

export const DialogueFocus = Extension.create<DialogueFocusOptions>({
  name: 'dialogueFocus',

  addOptions() {
    return {
      dimmedClass: 'dialogue-dimmed', // Class to apply for dimming
    }
  },

  addCommands() {
    return {
      setDialogueFocus:
        conversationId =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(dialogueFocusPluginKey, { focusedConversationId: conversationId })
          }
          return true
        },
      unsetDialogueFocus:
        () =>
        ({ commands }) => {
          // Shortcut for setting focus to null
          return commands.setDialogueFocus(null)
        },
    }
  },

  addProseMirrorPlugins() {
    // Using `this` directly inside the plugin methods is standard practice here
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const extensionThis = this

    return [
      new Plugin({
        key: dialogueFocusPluginKey,
        state: {
          init() {
            // Initial state: no conversation is focused
            return { focusedConversationId: null as string | null }
          },
          apply(tr, value) {
            const meta = tr.getMeta(dialogueFocusPluginKey)
            // If a meta action with focusedConversationId exists, update the state
            if (meta && meta.focusedConversationId !== undefined) {
              return { focusedConversationId: meta.focusedConversationId }
            }
            // Otherwise, keep the current state
            return value
          },
        },
        props: {
          decorations(state) {
            const pluginState = dialogueFocusPluginKey.getState(state)
            const focusedConversationId = pluginState?.focusedConversationId

            if (!focusedConversationId) {
              return DecorationSet.empty
            }

            let minStartPos = Infinity
            let maxEndPos = -1
            const dimmedClass = extensionThis.options.dimmedClass

            // First pass: Find the start and end boundaries of the focused conversation
            state.doc.descendants((node, pos) => {
              // Check marks on text nodes or any node that might carry marks
              if (node.marks.length > 0) {
                const dialogueMark = node.marks.find(mark => mark.type.name === 'dialogue')
                if (dialogueMark?.attrs.conversationId === focusedConversationId) {
                  minStartPos = Math.min(minStartPos, pos)
                  maxEndPos = Math.max(maxEndPos, pos + node.nodeSize)
                }
              }
              // Important: Return true to continue descending through all nodes
              // to catch all potential marks within paragraphs etc.
              return true
            })

            // If no nodes found for the conversation, return empty set
            if (minStartPos === Infinity) {
              return DecorationSet.empty
            }

            const decorations: Decoration[] = []
            const docSize = state.doc.content.size

            // Add decoration for content *before* the conversation block
            if (minStartPos > 0) {
              decorations.push(
                Decoration.inline(0, minStartPos, {
                  class: dimmedClass,
                }),
              )
            }

            // Add decoration for content *after* the conversation block
            if (maxEndPos < docSize) {
              decorations.push(
                Decoration.inline(maxEndPos, docSize, {
                  class: dimmedClass,
                }),
              )
            }

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
