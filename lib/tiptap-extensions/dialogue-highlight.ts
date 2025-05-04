import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface DialogueHighlightOptions {
  highlightClass: string
}

// Define the structure for the plugin's state
interface DialogueHighlightState {
  highlightAll: boolean // Flag for general highlighting
  focusedConversationId: string | null
  highlightCharacterName: string | null
  dialogueMode: boolean // Track if dialogue mode is active
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dialogueHighlight: {
      /** Sets highlighting for all dialogue */
      setDialogueHighlight: (active: boolean) => ReturnType
      /** Sets highlighting for a specific character within a conversation */
      setDialogueHighlightCharacter: (conversationId: string, characterName: string) => ReturnType
      /** Removes all dialogue highlighting */
      clearDialogueHighlight: () => ReturnType // Renamed for clarity
      /** Set dialogue mode (for bubble menu and other UI elements) */
      setDialogueMode: (active: boolean) => ReturnType
    }
  }
}

export const dialogueHighlightPluginKey = new PluginKey<DialogueHighlightState>('dialogue-highlight')

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
            tr.setMeta(dialogueHighlightPluginKey, {
              highlightAll: active,
              focusedConversationId: null, // Clear specific highlighting
              highlightCharacterName: null,
            })
          }
          return true
        },
      setDialogueHighlightCharacter:
        (conversationId, characterName) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(dialogueHighlightPluginKey, {
              highlightAll: false, // Ensure general highlighting is off
              focusedConversationId: conversationId,
              highlightCharacterName: characterName,
            })
          }
          return true
        },
      // Renamed command
      clearDialogueHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(dialogueHighlightPluginKey, {
              highlightAll: false,
              focusedConversationId: null,
              highlightCharacterName: null,
            })
          }
          return true
        },
      // New command for setting dialogue mode
      setDialogueMode:
        active =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(dialogueHighlightPluginKey, {
              dialogueMode: active,
            })
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this // Necessary alias, disable linter warning
    return [
      new Plugin({
        key: dialogueHighlightPluginKey,
        state: {
          // Initialize state with highlighting off
          init(): DialogueHighlightState {
            return {
              highlightAll: false,
              focusedConversationId: null,
              highlightCharacterName: null,
              dialogueMode: false,
            }
          },
          // Apply state changes from meta transactions
          apply(tr, value): DialogueHighlightState {
            const meta = tr.getMeta(dialogueHighlightPluginKey)
            if (meta) {
              return { ...value, ...meta } // Merge meta into existing state
            }
            return value
          },
        },
        props: {
          decorations(state) {
            const pluginState = dialogueHighlightPluginKey.getState(state)
            if (!pluginState || (!pluginState.highlightAll && !pluginState.focusedConversationId)) {
              return DecorationSet.empty // No highlighting active
            }

            const decorations: Decoration[] = []
            const { highlightAll, focusedConversationId, highlightCharacterName } = pluginState

            state.doc.descendants((node, pos) => {
              if (!node.isText || node.marks.length === 0) return

              node.marks.forEach(mark => {
                if (mark.type.name === 'dialogue') {
                  let shouldHighlight = false

                  if (highlightAll) {
                    // Mode 1: Highlight all dialogue marks
                    shouldHighlight = true
                  } else if (
                    focusedConversationId &&
                    highlightCharacterName &&
                    mark.attrs.conversationId === focusedConversationId &&
                    mark.attrs.character === highlightCharacterName
                  ) {
                    // Mode 2: Highlight specific character in specific conversation
                    shouldHighlight = true
                  }

                  if (shouldHighlight) {
                    decorations.push(
                      Decoration.inline(pos, pos + node.nodeSize, {
                        class: self.options.highlightClass,
                      }),
                    )
                    return // Stop checking marks for this node once highlighted
                  }
                }
              })
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
