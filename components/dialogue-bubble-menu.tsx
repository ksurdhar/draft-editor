import React, { useState } from 'react'
import { Editor } from '@tiptap/react'
import { nanoid } from 'nanoid'

interface DialogueBubbleMenuProps {
  editor: Editor
  // We might need a prop to know if dialogue editing mode is active
  // isDialogueEditMode: boolean;
}

const DialogueBubbleMenu: React.FC<DialogueBubbleMenuProps> = ({ editor }) => {
  const [speaker, setSpeaker] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [conversationName, setConversationName] = useState('')

  // TODO: Add logic to pre-fill based on existing marks if selection is within one

  const handleApplyDialogue = () => {
    if (!speaker) return // Require at least a speaker

    const finalConversationId = conversationId || `conv-${nanoid(6)}`

    editor
      .chain()
      .setDialogueMark({
        character: speaker,
        conversationId: finalConversationId,
        conversationName: conversationName || undefined, // Use undefined if empty
        userConfirmed: true, // Mark as confirmed since user is explicitly setting it
      })
      .run()

    // Optionally clear fields after applying
    // setSpeaker('');
    // setConversationId('');
    // setConversationName('');
  }

  // TODO: Add better styling later
  return (
    <div className="rounded bg-white p-2 shadow-md">
      <div className="mb-2 flex flex-col gap-1">
        <input
          type="text"
          value={speaker}
          onChange={e => setSpeaker(e.target.value)}
          placeholder="Speaker Name"
          className="rounded border px-1 py-0.5 text-sm"
        />
        <input
          type="text"
          value={conversationName}
          onChange={e => setConversationName(e.target.value)}
          placeholder="Conversation Name (Optional)"
          className="rounded border px-1 py-0.5 text-sm"
        />
        <input
          type="text"
          value={conversationId}
          onChange={e => setConversationId(e.target.value)}
          placeholder="Conversation ID (Optional)"
          className="rounded border px-1 py-0.5 text-sm"
        />
      </div>
      <button
        onClick={handleApplyDialogue}
        disabled={!speaker}
        className="rounded bg-blue-500 px-2 py-1 text-xs text-white disabled:opacity-50">
        Apply Dialogue
      </button>
    </div>
  )
}

export default DialogueBubbleMenu
