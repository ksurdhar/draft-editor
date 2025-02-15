'use client'
import { VersionData } from '@typez/globals'
import { useCallback } from 'react'
import useSWR from 'swr'
import { useAPI } from './providers'
import { ClockIcon, EyeIcon, RewindIcon } from '@heroicons/react/outline'
import { ListItem } from './list-item'

interface VersionListProps {
  documentId: string
  onPreview: (version: VersionData) => void
  onRestore: (version: VersionData) => void
}

const VersionList = ({ documentId, onPreview, onRestore }: VersionListProps) => {
  const api = useAPI()
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
    <div className="flex flex-col gap-1">
      <div className="mb-2 text-sm font-medium text-black/50">Document Versions</div>
      {versions.map((version) => (
        <ListItem
          key={version.id}
          label={new Date(version.createdAt).toLocaleDateString()}
          leftIcon={<ClockIcon className="h-4 w-4 text-black/30" />}
          theme="dark"
          rightContent={
            <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview(version)
                }}
                className="rounded p-1 hover:bg-black/5"
                title="Preview version"
              >
                <EyeIcon className="h-4 w-4 text-black/50" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRestore(version)
                }}
                className="rounded p-1 hover:bg-black/5"
                title="Restore version"
              >
                <RewindIcon className="h-4 w-4 text-black/50" />
              </button>
            </div>
          }
        >
          {version.name && (
            <div className="pl-12 text-sm text-black/50">{version.name}</div>
          )}
        </ListItem>
      ))}
    </div>
  )
}

export default VersionList 