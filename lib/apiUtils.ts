import Mongoose from 'mongoose'
import Document from './documentsModel'

declare global {
  // allow global `var` declarations
  // eslint-disable-next-line no-var
  var db: Mongoose.Connection | undefined
}

const connectToMongo = () => {
  if (!global.db) {
    Mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`)
    global.db = Mongoose.connection
  }
  
  global.db.on('error', console.error.bind(console, 'connection error: '))
  global.db.once('open', () => {
    console.log('Connected successfully')  
  })
}

type DocumentAttributes = {
  title?: string
  content?: string
  userId?: string
  lastUpdated?: number
}

export const getDocuments = async (userId: string) => {
  connectToMongo()
  const documents = await Document.find({ userId })
  return documents.map((document) => document.toJSON())
}

export const getEverybodysDocuments = async () => {
  connectToMongo()
  const documents = await Document.find({})
  return documents.map((document) => document.toJSON())
}

export const createDocument = async (body: DocumentAttributes) => {
  connectToMongo()
  const defaultContent = JSON.stringify([{ type: 'default', children: [{ text: '', highlight: 'none' }],}])
  const document = await Document.create({ title: body.title, content: defaultContent, userId: body.userId }) // see if default value in model applies
  await document.save()
  return document.toJSON()
}

export const getDocument = async (id: string) => {
  connectToMongo()
  const document = await Document.findById(id)
  if (!document) return null
  return document.toJSON()
}

export const updateDocument = async (id: string, body: DocumentAttributes) => {
  connectToMongo()
  // doesn't return new content, but nor does it really need to as of now
  const updatedDocument = await Document.findByIdAndUpdate(id, body)
  if (!updatedDocument) return null
  return updatedDocument.toJSON()
}

export const deleteDocument = async (id: string) => {
  connectToMongo()
  try {
    await Document.deleteOne({ _id: id })
  } catch (e) {
    console.log('ERROR:', e)
  }
}