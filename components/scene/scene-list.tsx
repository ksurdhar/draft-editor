'use client'
import { useState, useEffect } from 'react'
import { PencilIcon, EyeIcon, EyeOffIcon, PlusIcon } from '@heroicons/react/outline'
import { ListItem } from '../list-item'
import { Editor } from '@tiptap/react'
import { findScenesInDoc, SceneInfo } from '../../lib/tiptap-extensions/scene'

interface SceneListProps {
  documentId: string
  editor: Editor | null
  isSyncing?: boolean
  onUpdateSceneTitle: (sceneId: string, newTitle: string) => void
  focusedSceneId: string | null
  onToggleFocus: (sceneId: string) => void
  onAddScene: () => void
}

const SceneList = ({
  editor,
  isSyncing = false,
  onUpdateSceneTitle,
  focusedSceneId,
  onToggleFocus,
  onAddScene,
}: SceneListProps) => {
  const [scenes, setScenes] = useState<SceneInfo[]>([])
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null)
  const [sceneTitleInput, setSceneTitleInput] = useState('')

  useEffect(() => {
    if (!editor) {
      setScenes([])
      return
    }

    const calculateScenes = (): SceneInfo[] => {
      if (!editor.state.doc) return []
      return findScenesInDoc(editor.state.doc)
    }

    setScenes(calculateScenes())

    const handleTransaction = () => {
      const newScenes = calculateScenes()
      setScenes(newScenes)
    }

    editor.on('transaction', handleTransaction)

    return () => {
      editor.off('transaction', handleTransaction)
    }
  }, [editor])

  const handleDoubleClickScene = (sceneId: string, currentTitle: string) => {
    setEditingSceneId(sceneId)
    setSceneTitleInput(currentTitle || '')
  }

  const handleSaveSceneTitle = () => {
    if (!editingSceneId) return
    const newTitle = sceneTitleInput.trim()
    onUpdateSceneTitle(editingSceneId, newTitle)
    setEditingSceneId(null)
    setSceneTitleInput('')
  }

  const handleCancelEditSceneTitle = () => {
    setEditingSceneId(null)
    setSceneTitleInput('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400">Scenes</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={onAddScene}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-gray-400 transition-colors hover:bg-white/[.05] hover:text-gray-600">
            <PlusIcon className="h-4 w-4" />
            <span className="text-xs">Add Scene</span>
          </button>
        </div>
      </div>

      {scenes.length === 0 ? (
        <div className="flex h-full items-center justify-center py-10">
          <div className="text-center text-xs text-black/50">
            {isSyncing ? 'Scanning for scenes...' : 'No scenes found. Add your first scene.'}
          </div>
        </div>
      ) : (
        <div className="mb-1 rounded-md border border-white/[.07] bg-white/[.01]">
          {scenes.map(scene => (
            <div key={scene.sceneId} className="border-b border-white/[.05] last:border-b-0">
              {editingSceneId === scene.sceneId ? (
                <div className="flex items-center gap-2 p-2">
                  <input
                    type="text"
                    value={sceneTitleInput}
                    onChange={e => setSceneTitleInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        handleSaveSceneTitle()
                      } else if (e.key === 'Escape') {
                        handleCancelEditSceneTitle()
                      }
                    }}
                    className="flex-grow rounded border border-white/20 bg-white/10 px-2 py-1 text-sm text-black/80 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                    placeholder="Scene Title"
                    autoFocus
                    onBlur={handleSaveSceneTitle}
                  />
                </div>
              ) : (
                <ListItem
                  label={
                    <div className="min-w-0">
                      <span className="block font-medium text-black/70">
                        {scene.title || 'Untitled Scene'}
                      </span>
                    </div>
                  }
                  leftIcon={
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        handleDoubleClickScene(scene.sceneId, scene.title)
                      }}
                      className="mr-2 rounded p-1 transition-colors hover:bg-white/[.1]"
                      title="Edit scene title">
                      <PencilIcon className="h-4 w-4 text-black/40" />
                    </button>
                  }
                  rightIcon={
                    <button
                      onClick={() => onToggleFocus(scene.sceneId)}
                      className={`rounded p-1 transition-colors ${
                        focusedSceneId === scene.sceneId
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'text-black/40 hover:bg-white/[.05] hover:text-black/60'
                      }`}
                      title={focusedSceneId === scene.sceneId ? 'Unfocus scene' : 'Focus scene'}>
                      {focusedSceneId === scene.sceneId ? (
                        <EyeOffIcon className="h-3.5 w-3.5" />
                      ) : (
                        <EyeIcon className="h-3.5 w-3.5" />
                      )}
                    </button>
                  }
                  onClick={() => {
                    if (editor) {
                      // Scroll to scene position
                      const element = document.querySelector(`[data-scene-id="${scene.sceneId}"]`)
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                    }
                  }}
                  theme="dark"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SceneList
