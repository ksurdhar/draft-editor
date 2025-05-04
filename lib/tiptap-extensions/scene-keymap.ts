import { Extension } from '@tiptap/core'
import { Selection } from '@tiptap/pm/state'

/* Helpers */
const isScene = (node: any) => node?.type?.name === 'scene'
const sceneIsEmpty = (scene: any) => scene.textContent.replace(/\s/g, '') === '' // ignores new‑lines & spaces

export const SceneKeymap = Extension.create({
  name: 'sceneKeymap',

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { state, view } = this.editor
        const { selection } = state
        const $from = selection.$from

        /* Guard – only act when caret is at start of its block */
        if (!selection.empty || $from.parentOffset !== 0) return false

        console.clear()
        console.log('⌫ pressed → pos', selection.from)

        /* ─────────────────────────────────────────
         * ①  Are we INSIDE a <scene> ?
         *    (walk up the ancestor chain)
         * ───────────────────────────────────────── */
        let sceneDepth: number | null = null
        for (let d = $from.depth; d > 0; d--) {
          if (isScene($from.node(d))) {
            sceneDepth = d
            break
          }
        }

        if (sceneDepth !== null) {
          const sceneNode = $from.node(sceneDepth)

          if (sceneIsEmpty(sceneNode)) {
            /* ①‑a  scene is COMPLETELY empty → delete it */
            const start = $from.before(sceneDepth)
            const end = start + sceneNode.nodeSize
            view.dispatch(state.tr.delete(start, end).scrollIntoView())
            return true
          }

          /* ①‑b  non‑empty scene → let default behaviour handle (e.g. merge lines) */
          return false
        }

        /* ─────────────────────────────────────────
         * ②  We're OUTSIDE a scene.
         *     Check the previous sibling at the same depth
         * ───────────────────────────────────────── */
        let nodeBefore = $from.nodeBefore
        if (!nodeBefore) {
          /* nodeBefore can be null at the very start of a paragraph;
             fall back to parent's child index */
          const idx = $from.index(0)
          if (idx > 0) nodeBefore = $from.node(0).child(idx - 1)
        }

        if (isScene(nodeBefore)) {
          if (sceneIsEmpty(nodeBefore)) {
            /* ②‑a  Empty scene right before caret → delete it */
            const sceneStart = selection.from - nodeBefore!.nodeSize
            view.dispatch(state.tr.delete(sceneStart, selection.from).scrollIntoView())
            return true
          }

          /* ②‑b  Non‑empty scene → jump caret to its end for seamless editing */
          const sceneEndPos = selection.from - 2 // one step into the scene
          view.dispatch(state.tr.setSelection(Selection.near(state.doc.resolve(sceneEndPos), -1)))
          return true
        }

        /* ─────────────────────────────────────────
         * ③  None of our cases matched – let PM handle
         * ───────────────────────────────────────── */
        return false
      },
    }
  },
})
