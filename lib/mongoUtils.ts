import Mongoose from 'mongoose'
import { DocumentData, PermissionData, UserPermission } from '../types/globals'
import { Doc, Permission } from './mongoModels'

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var db: Mongoose.Connection | undefined
}

export const getDocuments = async (userId: string) => {
  const documents = await Doc.find({ userId })
  return documents.map((document) => document.toJSON())
}

export const getEverybodysDocuments = async () => {
  const documents = await Doc.find({})
  return documents.map((document) => document.toJSON())
}

export const createDocument = async (body: Partial<DocumentData>, userEmail: string) => {
  const defaultContent = JSON.stringify([{ type: 'default', children: [{ text: '', highlight: 'none' }],}])
  const document = await Doc.create({ 
    title: body.title, 
    content: defaultContent, 
    userId: body.userId, 
    comments: [],
    view: [userEmail],
    edit: [userEmail],
    comment: [userEmail], 
  })
  await document.save()
  return document.toJSON()
}

export const createPermission = async (body: Partial<PermissionData>) => {
  const permission = await Permission.create({ 
    documentId: body.documentId, 
    ownerId: body.ownerId, 
    users: [],
    globalPermission: UserPermission.None
  })
  await permission.save()
  return permission.toJSON()
}

export const getDocument = async (id: string) => {
  const document = await Doc.findById(id)
  if (!document) return null
  return document.toJSON()
}

export const getPermission = async (id: string) => {
  const permission = await Permission.findById(id)
  if (!permission) return null
  return permission.toJSON()
}

export const getPermissionByDoc = async (documentId: string) => {
  const permission = await Permission.findOne({ documentId })
  if (!permission) return null
  return permission.toJSON()
}

export const updateDocument = async (id: string, body: Partial<DocumentData>) => {
  const updatedDocument = await Doc.findByIdAndUpdate(id, body, {returnDocument: 'after'})
  if (!updatedDocument) return null
  return updatedDocument.toJSON()
}

export const updatePermissionByDoc = async (documentId: string, body: Partial<PermissionData>) => {
  const updatedPermission = await Permission.findOneAndUpdate({ documentId }, body, {returnDocument: 'after'})
  if (!updatedPermission) return null
  return updatedPermission.toJSON()
}

export const deleteDocument = async (id: string) => {
  try {
    await Doc.deleteOne({ _id: id })
  } catch (e) {
    console.log('ERROR:', e)
  }
}

export const deletePermission = async (id: string) => {
  try {
    await Permission.deleteOne({ _id: id })
  } catch (e) {
    console.log('ERROR:', e)
  }
}

export const deletePermissionByDoc = async (documentId: string) => {
  try {
    await Permission.findOneAndDelete({ documentId })
  } catch (e) {
    console.log('ERROR:', e)
  }
}