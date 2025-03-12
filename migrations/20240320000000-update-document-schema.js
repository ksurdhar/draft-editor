module.exports = {
  async up(db) {
    const session = db.client.startSession()
    try {
      await session.withTransaction(async () => {
        console.log('Starting migration...')

        // 1. Update all existing documents to use the new TipTap format
        console.log('Updating documents to TipTap format...')
        const documents = await db.collection('documents').find({}).toArray()
        console.log(`Found ${documents.length} documents to update`)

        for (const doc of documents) {
          const newContent = {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: typeof doc.content === 'string' ? doc.content : '',
                  },
                ],
              },
            ],
          }

          await db.collection('documents').updateOne(
            { _id: doc._id },
            {
              $set: {
                content: newContent,
                parentId: 'root',
                folderIndex: 0,
                lastUpdated: doc.lastUpdated || Date.now(),
              },
            },
          )
        }

        // 2. Create folders collection if it doesn't exist
        console.log('Setting up folders collection...')
        const collections = await db.listCollections().toArray()
        const folderCollectionExists = collections.some(c => c.name === 'folders')

        if (!folderCollectionExists) {
          console.log('Creating folders collection...')
          await db.createCollection('folders')
        } else {
          console.log('Folders collection already exists')
        }

        // 3. Create indexes safely (will not recreate if they exist)
        console.log('Creating indexes...')
        await db.collection('folders').createIndex({ userId: 1 }, { background: true })
        await db.collection('folders').createIndex({ parentId: 1 }, { background: true })
        await db.collection('documents').createIndex({ userId: 1 }, { background: true })
        await db.collection('documents').createIndex({ parentId: 1 }, { background: true })

        console.log('Migration completed successfully')
      })
    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    } finally {
      await session.endSession()
    }
  },

  async down(db) {
    const session = db.client.startSession()
    try {
      await session.withTransaction(async () => {
        console.log('Starting rollback...')

        // 1. Convert documents back to string content
        console.log('Converting documents back to string content...')
        const documents = await db.collection('documents').find({}).toArray()
        console.log(`Found ${documents.length} documents to rollback`)

        for (const doc of documents) {
          let stringContent = ''
          if (doc.content && typeof doc.content === 'object') {
            // Extract text from TipTap format
            stringContent = doc.content.content?.[0]?.content?.[0]?.text || ''
          }

          await db.collection('documents').updateOne(
            { _id: doc._id },
            {
              $set: { content: stringContent },
              $unset: { parentId: '', folderIndex: '' },
            },
          )
        }

        // 2. Drop folders collection if it exists
        console.log('Dropping folders collection...')
        try {
          await db.collection('folders').drop()
        } catch (error) {
          if (!error.message.includes('ns not found')) {
            throw error
          }
        }

        // 3. Remove new indexes if they exist
        console.log('Removing indexes...')
        try {
          await db.collection('documents').dropIndex('parentId_1')
        } catch (error) {
          if (!error.message.includes('index not found')) {
            throw error
          }
        }

        console.log('Rollback completed successfully')
      })
    } catch (error) {
      console.error('Rollback failed:', error)
      throw error
    } finally {
      await session.endSession()
    }
  },
}
