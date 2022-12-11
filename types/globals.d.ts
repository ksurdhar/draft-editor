import { ReactEditor } from 'slate-react'
import { BaseEditor } from 'slate'
import { HistoryEditor } from 'slate-history'

type DocumentData = {
  id: string
  title: string
  content: string
  comments: CommentData[]
  lastUpdated: number
  userId: string
  edit: string[]
  view: string[]
}

type CommentData = {
  id: string
  timestamp: number
  content: string
}

type AnimationState = 'Active' | 'Complete' | 'Inactive'

type WhetstoneEditor = BaseEditor & ReactEditor & HistoryEditor