import Mongoose from 'mongoose'
import { DocumentData } from '../types/globals'
import Document from './documentsModel'

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var db: Mongoose.Connection | undefined
}

export const getDocuments = async (userId: string) => {
  const documents = await Document.find({ userId })
  return documents.map((document) => document.toJSON())
}

export const getEverybodysDocuments = async () => {
  const documents = await Document.find({})
  return documents.map((document) => document.toJSON())
}

export const createDocument = async (body: Partial<DocumentData>, userEmail: string) => {
  const defaultContent = JSON.stringify([{ type: 'default', children: [{ text: '', highlight: 'none' }],}])
  const document = await Document.create({ 
    title: body.title, 
    content: defaultContent, 
    userId: body.userId, 
    comments: [],
    view: [userEmail],
    edit: [userEmail] 
  })
  await document.save()
  return document.toJSON()
}

export const getDocument = async (id: string) => {
  const document = await Document.findById(id)
  if (!document) return null
  return document.toJSON()
}

export const updateDocument = async (id: string, body: Partial<DocumentData>) => {
  // doesn't return new content, but nor does it really need to as of now
  const updatedDocument = await Document.findByIdAndUpdate(id, body)
  if (!updatedDocument) return null
  return updatedDocument.toJSON()
}

export const deleteDocument = async (id: string) => {
  try {
    await Document.deleteOne({ _id: id })
  } catch (e) {
    console.log('ERROR:', e)
  }
}