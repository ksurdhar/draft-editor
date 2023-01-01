import { ReactEditor } from 'slate-react'
import { BaseEditor } from 'slate'
import { HistoryEditor } from 'slate-history'

export type DocumentData = {
  id: string
  title: string
  content: string
  comments: CommentData[]
  lastUpdated: number
  userId: string
  edit: string[]
  view: string[]
  comment: string[]
  canEdit?: boolean
  canComment?: boolean
}

type CommentData = {
  id: string
  timestamp: number
  content: string
}

export type ShareUser = {
  email: string
  permission: UserPermission
}

export type PermissionData = {
  documentId: string
  ownerId: string
  globalPermission: UserPermission
  users: ShareUser[]
}

export enum UserPermission {
  View = 'View',
  Comment = 'Comment',
  Edit = 'Edit',
  None = 'None'
}

type AnimationState = 'Active' | 'Complete' | 'Inactive'

type WhetstoneEditor = BaseEditor & ReactEditor & HistoryEditor