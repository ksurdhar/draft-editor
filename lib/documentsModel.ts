import Mongoose, { Document, Model } from 'mongoose'

// Mongo Init Code
if (!global.db) {
  Mongoose.connect(`mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`)
  global.db = Mongoose.connection
}
global.db.on('error', console.error.bind(console, 'connection error: '))
global.db.once('open', () => {
  console.log('Connected successfully')  
})

const DocumentSchema = new Mongoose.Schema({
  title: {
    type: Mongoose.Schema.Types.String,
    default: '',
  },
  content: {
    type: Mongoose.Schema.Types.String,
    default: '',
  },
  comments: {
    type: [{ 
      content: Mongoose.Schema.Types.String, 
      id: Mongoose.Schema.Types.String
    }],
    default: []
  },
  userId: {
    type: Mongoose.Schema.Types.String,
    required: true
  },
  lastUpdated: {
    type: Mongoose.Schema.Types.Number,
    default: Date.now()
  },
  edit: {
    type: [Mongoose.Schema.Types.String],
    default: []
  },
  view: {
    type: [Mongoose.Schema.Types.String],
    default: []
  },
  comment: {
    type: [Mongoose.Schema.Types.String],
    default: []
  },
  coment: {
    type: [Mongoose.Schema.Types.String],
    default: []
  },
})

// replaces _id with id and removes versionKey when converted to json
DocumentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) { delete ret._id  }
})

export interface IDoc {
  title: string
  content: string
  comments: string[] // not quite true
  userId: string
  lastUpdated: number
  view: string[]
  edit: string[]
  comment: string[]
  coment: string[]
}
export interface IDocDocument extends IDoc, Document {}
export interface IDocModel extends Model<IDocDocument> {}

const Doc = Mongoose.models && Mongoose.models.Document || Mongoose.model<IDocDocument>('Document', DocumentSchema) 

export default Doc as IDocModel