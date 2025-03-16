// Migration script to add Character and DialogueEntry collections to MongoDB
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// MongoDB connection string
const MONGO_DB =
  process.env.LOCAL_DB === 'true'
    ? 'mongodb://localhost:27017/whetstone'
    : `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSTER}.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`

console.log('\n=== MongoDB Migration ===')
console.log('MOCK_AUTH:', process.env.MOCK_AUTH)
console.log('LOCAL_DB:', process.env.LOCAL_DB)
console.log('DB_USER:', process.env.DB_USER ? 'defined' : 'undefined')
console.log('DB_PASS:', process.env.DB_PASS ? '[REDACTED]' : 'undefined')
console.log('DB_CLUSTER:', process.env.DB_CLUSTER)
console.log('DB_NAME:', process.env.DB_NAME)
console.log('Connection string:', MONGO_DB.replace(process.env.DB_PASS || '', '[REDACTED]'))

// Define schemas for migration
const DialogueEntrySchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.String,
    required: true,
  },
  characterId: {
    type: mongoose.Schema.Types.String,
    required: true,
  },
  characterName: {
    type: mongoose.Schema.Types.String,
    required: true,
  },
  documentId: {
    type: mongoose.Schema.Types.String,
    required: true,
  },
  documentTitle: {
    type: mongoose.Schema.Types.String,
    default: '',
  },
  content: {
    type: mongoose.Schema.Types.String,
    required: true,
  },
  location: {
    paragraphIndex: {
      type: mongoose.Schema.Types.Number,
      default: 0,
    },
    paragraphHash: {
      type: mongoose.Schema.Types.String,
      default: '',
    },
  },
  context: {
    before: {
      type: mongoose.Schema.Types.String,
      default: '',
    },
    after: {
      type: mongoose.Schema.Types.String,
      default: '',
    },
  },
  sceneInfo: {
    sceneId: {
      type: mongoose.Schema.Types.String,
      default: '',
    },
    sceneName: {
      type: mongoose.Schema.Types.String,
      default: '',
    },
  },
  lastUpdated: {
    type: mongoose.Schema.Types.Number,
    default: Date.now(),
  },
  isValid: {
    type: mongoose.Schema.Types.Boolean,
    default: true,
  },
})

const CharacterSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.String,
    required: true,
  },
  name: {
    type: mongoose.Schema.Types.String,
    required: true,
  },
  motivation: {
    type: mongoose.Schema.Types.String,
    default: '',
  },
  description: {
    type: mongoose.Schema.Types.String,
    default: '',
  },
  traits: {
    type: [mongoose.Schema.Types.String],
    default: [],
  },
  relationships: {
    type: [
      {
        characterId: mongoose.Schema.Types.String,
        relationshipType: mongoose.Schema.Types.String,
        description: mongoose.Schema.Types.String,
      },
    ],
    default: [],
  },
  userId: {
    type: mongoose.Schema.Types.String,
    required: true,
  },
  documentIds: {
    type: [mongoose.Schema.Types.String],
    default: [],
  },
  lastUpdated: {
    type: mongoose.Schema.Types.Number,
    default: Date.now(),
  },
  isArchived: {
    type: mongoose.Schema.Types.Boolean,
    default: false,
  },
})

async function runMigration() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_DB)
    console.log('Connected to MongoDB')

    // Create models
    const DialogueEntry = mongoose.model('DialogueEntry', DialogueEntrySchema)
    const Character = mongoose.model('Character', CharacterSchema)

    // Create indexes for better query performance
    console.log('Creating indexes...')

    // DialogueEntry indexes
    await DialogueEntry.collection.createIndex({ characterId: 1 })
    await DialogueEntry.collection.createIndex({ documentId: 1 })
    await DialogueEntry.collection.createIndex({ 'location.paragraphIndex': 1, documentId: 1 })

    // Character indexes
    await Character.collection.createIndex({ name: 1 })
    await Character.collection.createIndex({ userId: 1 })
    await Character.collection.createIndex({ documentIds: 1 })

    console.log('Indexes created successfully')

    // Create a sample character and dialogue entry if collections are empty
    const characterCount = await Character.countDocuments()
    const dialogueCount = await DialogueEntry.countDocuments()

    if (characterCount === 0) {
      console.log('Creating sample character...')
      const sampleCharacter = new Character({
        _id: uuidv4(),
        name: 'Sample Character',
        motivation: 'To serve as an example',
        description: 'A sample character created during migration',
        traits: ['sample', 'example'],
        userId: 'system',
      })
      await sampleCharacter.save()
      console.log('Sample character created with ID:', sampleCharacter._id)
    } else {
      console.log(`Character collection already has ${characterCount} documents`)
    }

    if (dialogueCount === 0) {
      console.log('Creating sample dialogue entry...')
      const characters = await Character.find().limit(1)
      if (characters.length > 0) {
        const sampleDialogue = new DialogueEntry({
          _id: uuidv4(),
          characterId: characters[0]._id,
          characterName: characters[0].name,
          documentId: 'sample-document',
          documentTitle: 'Sample Document',
          content: 'This is a sample dialogue entry.',
          context: {
            before: 'Text before the dialogue.',
            after: 'Text after the dialogue.',
          },
          lastUpdated: Date.now(),
        })
        await sampleDialogue.save()
        console.log('Sample dialogue entry created with ID:', sampleDialogue._id)
      }
    } else {
      console.log(`DialogueEntry collection already has ${dialogueCount} documents`)
    }

    console.log('Migration completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    // Close the connection
    await mongoose.connection.close()
    console.log('MongoDB connection closed')
  }
}

// Run the migration
runMigration()
