import Mongoose from 'mongoose'

const DocumentSchema = new Mongoose.Schema({
  title: {
    type: String,
    default: '',
  },
  content: {
    type: String,
    default: '',
  },
})

// replaces _id with id and removes versionKey
DocumentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) { delete ret._id  }
})

const Document = Mongoose.models.Document || Mongoose.model('Document', DocumentSchema)

export default Document 