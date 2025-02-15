'use client'
import { VersionData } from '@typez/globals'
import { useCallback, useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useAPI } from './providers'
import { ClockIcon, EyeIcon, RewindIcon, PlusIcon, TrashIcon } from '@heroicons/react/outline'
import { ListItem } from './list-item'
import DeleteModal from './delete-modal'

interface VersionListProps {
  documentId: string
  onPreview: (version: VersionData) => void
  onRestore: (version: VersionData) => void
}

const VersionList = ({ documentId, onPreview, onRestore }: VersionListProps) => {
  const api = useAPI()
  const [versionToDelete, setVersionToDelete] = useState<VersionData | null>(null)
  
  const fetcher = useCallback(
    async (path: string) => {
      return await api.get(path)
    },
    [api],
  )

  const { data: versions = [], isLoading } = useSWR<VersionData[]>(
    `/documents/${documentId}/versions`,
    fetcher
  )

  const handleCreateVersion = async () => {
    try {
      const doc = await api.get(`/documents/${documentId}`)
      await api.post(`/documents/${documentId}/versions`, {
        documentId,
        content: doc.content,
        createdAt: Date.now(),
        name: ''
      })
      mutate(`/documents/${documentId}/versions`)
    } catch (error) {
      console.error('Error creating version:', error)
    }
  }

  const handleDeleteVersion = async () => {
    if (!versionToDelete) return

    try {
      await api.delete(`/documents/${documentId}/versions?versionId=${versionToDelete.id}`)
      mutate(`/documents/${documentId}/versions`)
      setVersionToDelete(null)
    } catch (error) {
      console.error('Error deleting version:', error)
    }
  }

  const handleDeleteClick = (version: VersionData) => {
    setVersionToDelete(version)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-black/50">Loading versions...</div>
      </div>
    )
  }

  if (versions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-black/50">No versions yet</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-400">Versions</h2>
        <button
          onClick={handleCreateVersion}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {versions.map((version) => (
        <ListItem
          key={version.id}
          label={new Date(version.createdAt).toLocaleString()}
          leftIcon={<ClockIcon className="w-4 h-4" />}
          theme="dark"
          rightContent={
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onPreview(version)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Preview version"
              >
                <EyeIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => onRestore(version)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Restore version"
              >
                <RewindIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteClick(version)}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                title="Delete version"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          }
        />
      ))}

      <DeleteModal
        open={!!versionToDelete}
        onClose={() => setVersionToDelete(null)}
        onConfirm={handleDeleteVersion}
        documentTitle={versionToDelete ? `version from ${new Date(versionToDelete.createdAt).toLocaleString()}` : ''}
      />
    </div>
  )
}

export default VersionList 