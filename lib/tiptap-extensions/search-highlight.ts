import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface SearchHighlightOptions {
  highlightClass: string
  currentMatchClass: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    searchHighlight: {
      setSearchHighlight: (positions: { from: number, to: number }[], currentMatch: number) => ReturnType
      unsetSearchHighlight: () => ReturnType
    }
  }
}

export const SearchHighlight = Extension.create<SearchHighlightOptions>({
  name: 'searchHighlight',

  addOptions() {
    return {
      highlightClass: 'search-result',
      currentMatchClass: 'search-result-current',
    }
  },

  addCommands() {
    return {
      setSearchHighlight:
        (positions, currentMatch) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            const decorations = positions.map((pos, index) =>
              Decoration.inline(pos.from, pos.to, {
                class: index === currentMatch ? this.options.currentMatchClass : this.options.highlightClass,
              })
            )
            const decos = DecorationSet.create(tr.doc, decorations)
            tr.setMeta(searchHighlightPluginKey, { decorations: decos })
          }
          return true
        },
      unsetSearchHighlight:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchHighlightPluginKey, { decorations: DecorationSet.empty })
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const key = searchHighlightPluginKey
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
            return this.getState(state).decorations
          },
        },
      }),
    ]
  },
})

export const searchHighlightPluginKey = new PluginKey('search-highlight') 