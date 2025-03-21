module.exports = {
  async up(db) {
    const session = db.client.startSession()
    try {
      await session.withTransaction(async () => {
        console.log('Starting migration to update Version schema...')

        // Get all versions
        const versions = await db.collection('versions').find({}).toArray()
        console.log(`Found ${versions.length} versions to update`)

        // Update each version's content field
        for (const version of versions) {
          let parsedContent = version.content

          // If content is a string, try to parse it as JSON
          if (typeof version.content === 'string') {
            try {
              parsedContent = JSON.parse(version.content)
            } catch (e) {
              // If parsing fails, create a default Tiptap document structure
              parsedContent = {
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: version.content,
                      },
                    ],
                  },
                ],
              }
            }
          }

          await db.collection('versions').updateOne(
            { _id: version._id },
            {
              $set: {
                content: parsedContent,
                // Ensure other required fields are present
                autoGenerated: version.autoGenerated || false,
                wordCount: version.wordCount || 0,
                name: version.name || '',
              },
            },
          )
        }

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

        // Get all versions
        const versions = await db.collection('versions').find({}).toArray()
        console.log(`Found ${versions.length} versions to rollback`)

        // Convert each version's content back to string
        for (const version of versions) {
          let stringContent = ''

          if (typeof version.content === 'object') {
            // Convert Tiptap JSON to string representation
            try {
              stringContent = JSON.stringify(version.content)
            } catch (e) {
              console.error('Error stringifying content:', e)
              stringContent = ''
            }
          }

          await db
            .collection('versions')
            .updateOne({ _id: version._id }, { $set: { content: stringContent } })
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
