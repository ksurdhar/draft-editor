import Mongoose, { Document, Model } from 'mongoose'

const DocumentSchema = new Mongoose.Schema({
  title: {
    type: Mongoose.Schema.Types.String,
    default: '',
  },
  content: {
    type: Mongoose.Schema.Types.String,
    default: '',
  },
  userId: {
    type: Mongoose.Schema.Types.String,
    required: true
  },
  lastUpdated: {
    type: Mongoose.Schema.Types.Number,
    default: Date.now()
  }
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
  userId: string
  lastUpdated: number
}
export interface IDocDocument extends IDoc, Document {}
export interface IDocModel extends Model<IDocDocument> {}

const Doc = Mongoose.models && Mongoose.models.Document || Mongoose.model<IDocDocument>('Document', DocumentSchema) 

export default Doc as IDocModel