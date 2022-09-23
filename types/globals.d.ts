import { ReactEditor } from 'slate-react'
import { BaseEditor } from 'slate'
import { HistoryEditor } from 'slate-history'

type DocumentData = {
  id: string
  title: string
  content: string
  comments: string[]
  lastUpdated: number
}

type AnimationState = 'Active' | 'Complete' | 'Inactive'

type WhetstoneEditor = BaseEditor & ReactEditor & HistoryEditor