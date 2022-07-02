import Mongoose from 'mongoose'
import Document from './documentsModel'

export const getDocuments = async () => {
  const username = 'xxxxxxxx'
  const password = 'xxxxxxxx'
  const cluster = 'xxxxxxxx'
  const dbname = 'xxxxxxxx'
  
  Mongoose.connect(`mongodb+srv://${username}:${password}@${cluster}.mongodb.net/${dbname}?retryWrites=true&w=majority`)
  const db = Mongoose.connection
  
  db.on('error', console.error.bind(console, 'connection error: '))
  db.once('open', async () => {
    console.log('Connected successfully')  
  })
  
  const documents = await Document.find({})
  return documents
}

