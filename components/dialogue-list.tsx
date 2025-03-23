'use client'
import { useCallback, useState } from 'react'
import useSWR from 'swr'
import { useAPI } from './providers'
import { ChatIcon, RefreshIcon } from '@heroicons/react/outline'
import { ListItem } from './list-item'

interface DialogueListProps {
  documentId: string
  currentContent: any
}

const DialogueList = ({ documentId, currentContent }: DialogueListProps) => {
  const api = useAPI()
  const [isLoading, setIsLoading] = useState(false)

  const fetcher = useCallback(
    async (path: string) => {
      return await api.get(path)
    },
    [api],
  )

  const { data: dialogueEntries = [] } = useSWR<any[]>(`/dialogue/document/${documentId}`, fetcher)

  const handleSyncDialogue = async () => {
    setIsLoading(true)
    try {
      console.log('Syncing dialogue for document:', documentId)
      console.log('Current content:', currentContent)
      // This would eventually parse the document content for dialogue
      // For now, just log that we're scanning for dialogue

      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      console.log('Dialogue sync complete')
    } catch (error) {
      console.error('Error syncing dialogue:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400">Dialogue</h2>
        <button
          onClick={handleSyncDialogue}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded px-2 py-1.5 text-gray-400 transition-colors hover:bg-white/[.05] hover:text-gray-600">
          <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-xs">{isLoading ? 'Syncing...' : 'Sync'}</span>
        </button>
      </div>

      {dialogueEntries.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-black/50">
            {isLoading ? 'Scanning for dialogue...' : 'No dialogue entries found'}
          </div>
        </div>
      ) : (
        dialogueEntries.map(entry => (
          <ListItem
            key={entry.id}
            label={`${entry.characterName}: ${entry.content.substring(0, 30)}${entry.content.length > 30 ? '...' : ''}`}
            leftIcon={<ChatIcon className="h-4 w-4" />}
            theme="dark"
          />
        ))
      )}
    </div>
  )
}

export default DialogueList
