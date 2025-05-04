import { Node, mergeAttributes, CommandProps } from '@tiptap/core'
import { v4 as uuidv4 } from 'uuid'
import { Fragment } from '@tiptap/pm/model'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface SceneOptions {
  HTMLAttributes: Record<string, any>
}

export interface SceneInfo {
  node: ProseMirrorNode
  pos: number
  sceneId: string
  title: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    scene: {
      /**
       * Create a new scene
       */
      createScene: (attrs?: { title?: string; sceneId?: string }) => ReturnType
      /**
       * Update a scene's title
       */
      updateSceneTitle: (sceneId: string, title: string) => ReturnType
      /**
       * Toggle scene highlighting
       */
      toggleSceneHighlight: (active: boolean) => ReturnType
    }
  }
}

// Helper function to get scenes from a document
export function findScenesInDoc(doc: ProseMirrorNode): SceneInfo[] {
  const scenes: SceneInfo[] = []

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === 'scene') {
      scenes.push({
        node,
        pos,
        sceneId: node.attrs.sceneId,
        title: node.attrs.title,
      })
    }
    return true
  })

  return scenes
}

export const Scene = Node.create<SceneOptions>({
  name: 'scene',

  group: 'block',
  content: 'block+',

  defining: true,
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      sceneId: {
        default: null,
        parseHTML: element => element.getAttribute('data-scene-id'),
        renderHTML: attributes => {
          if (!attributes.sceneId) {
            return {}
          }
          return {
            'data-scene-id': attributes.sceneId,
          }
        },
      },
      title: {
        default: '',
        parseHTML: element => element.getAttribute('data-scene-title'),
        renderHTML: attributes => {
          if (!attributes.title) {
            return {}
          }
          return {
            'data-scene-title': attributes.title,
          }
        },
      },
      highlighted: {
        default: false,
        parseHTML: element => element.getAttribute('data-highlighted') === 'true',
        renderHTML: attributes => {
          if (!attributes.highlighted) {
            return {}
          }
          return {
            'data-highlighted': 'true',
          }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="scene"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const renderAttributes = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-type': 'scene',
      class: HTMLAttributes.highlighted ? 'scene-node scene-highlighted' : 'scene-node',
    })

    return ['div', renderAttributes, 0]
  },

  addCommands() {
    return {
      createScene:
        (attrs = {}) =>
        ({ tr, dispatch, editor }: CommandProps) => {
          if (!dispatch) return false

          // Generate a unique ID if not provided
          const sceneId = attrs.sceneId || uuidv4()

          // Create a new scene node
          const scene = this.type.create({
            sceneId,
            title: attrs.title || `Scene ${Math.floor(Math.random() * 1000)}`,
          })

          // Create a paragraph inside the scene
          const paragraph = editor.schema.nodes.paragraph.create()

          // Add content to the scene - use Fragment.from() to convert array to Fragment
          const sceneWithContent = scene.copy(Fragment.from([paragraph]))

          // Insert at the beginning of the document
          const position = 0
          tr.insert(position, sceneWithContent)

          return true
        },

      updateSceneTitle:
        (sceneId, title) =>
        ({ tr, state, dispatch }: CommandProps) => {
          if (!dispatch) return false

          let modified = false
          const { doc } = state

          doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (node.type.name === this.name && node.attrs.sceneId === sceneId) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                title,
              })
              modified = true
              return false // Stop descending
            }
            return true
          })

          if (modified) {
            dispatch(tr)
          }

          return modified
        },

      toggleSceneHighlight:
        active =>
        ({ tr, state, dispatch }: CommandProps) => {
          if (!dispatch) return false

          let modified = false
          const { doc } = state

          doc.descendants((node: ProseMirrorNode, pos: number) => {
            if (node.type.name === this.name) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                highlighted: active,
              })
              modified = true
            }
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
