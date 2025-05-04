import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface SceneHighlightOptions {
  highlightClass: string
}

// Define the structure for the plugin's state
interface SceneHighlightState {
  highlightAll: boolean // Flag for general highlighting
  focusedSceneId: string | null
  sceneMode: boolean // Track if scene mode is active
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneHighlight: {
      /** Sets highlighting for all scenes */
      setSceneHighlight: (active: boolean) => ReturnType
      /** Sets highlighting for a specific scene */
      setSceneFocus: (sceneId: string | null) => ReturnType
      /** Removes all scene highlighting */
      clearSceneHighlight: () => ReturnType
      /** Set scene mode (for UI elements) */
      setSceneMode: (active: boolean) => ReturnType
    }
  }
}

export const sceneHighlightPluginKey = new PluginKey<SceneHighlightState>('scene-highlight')

export const SceneHighlight = Extension.create<SceneHighlightOptions>({
  name: 'sceneHighlight',

  addOptions() {
    return {
      highlightClass: 'scene-highlighted',
    }
  },

  addCommands() {
    return {
      setSceneHighlight:
        active =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(sceneHighlightPluginKey, {
              highlightAll: active,
              focusedSceneId: null, // Clear specific highlighting
            })
          }
          return true
        },
      setSceneFocus:
        sceneId =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(sceneHighlightPluginKey, {
              highlightAll: false, // Ensure general highlighting is off
              focusedSceneId: sceneId,
            })
          }
          return true
        },
      clearSceneHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(sceneHighlightPluginKey, {
              highlightAll: false,
              focusedSceneId: null,
            })
          }
          return true
        },
      setSceneMode:
        active =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(sceneHighlightPluginKey, {
              sceneMode: active,
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
        key: sceneHighlightPluginKey,
        state: {
          // Initialize state with highlighting off
          init(): SceneHighlightState {
            return {
              highlightAll: false,
              focusedSceneId: null,
              sceneMode: false,
            }
          },
          // Apply state changes from meta transactions
          apply(tr, value): SceneHighlightState {
            const meta = tr.getMeta(sceneHighlightPluginKey)
            if (meta) {
              return { ...value, ...meta } // Merge meta into existing state
            }
            return value
          },
        },
        props: {
          decorations(state) {
            const pluginState = sceneHighlightPluginKey.getState(state)
            if (!pluginState || (!pluginState.highlightAll && !pluginState.focusedSceneId)) {
              return DecorationSet.empty // No highlighting active
            }

            const decorations: Decoration[] = []
            const { highlightAll, focusedSceneId } = pluginState

            state.doc.descendants((node, pos) => {
              if (node.type.name === 'scene') {
                let shouldHighlight = false

                if (highlightAll) {
                  // Mode 1: Highlight all scenes
                  shouldHighlight = true
                } else if (focusedSceneId && node.attrs.sceneId === focusedSceneId) {
                  // Mode 2: Highlight specific scene
                  shouldHighlight = true
                }

                if (shouldHighlight) {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: self.options.highlightClass,
                    }),
                  )
                }
              }
            })

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})
