const Y = require('yjs')

module.exports = {
  async up(db) {
    console.log('\n=== Starting Migration to YJS ===')
    
    // Migrate documents
    const documents = await db.collection('documents').find({}).toArray()
    console.log(`Found ${documents.length} documents to migrate`)

    for (const doc of documents) {
      console.log(`\nMigrating document: ${doc._id}`)
      
      // Skip if already migrated
      if (doc.content?.type === 'yjs') {
        console.log('Document already in YJS format, skipping...')
        continue
      }

      // Create YDoc and insert content
      const ydoc = new Y.Doc()
      const ytext = ydoc.getText('content')
      
      if (typeof doc.content === 'string') {
        ytext.insert(0, doc.content)
      } else {
        ytext.insert(0, JSON.stringify(doc.content))
      }

      // Update document with YJS state
      await db.collection('documents').updateOne(
        { _id: doc._id },
        {
          $set: {
            content: {
              type: 'yjs',
              state: Array.from(Y.encodeStateAsUpdate(ydoc))
            }
          }
        }
      )
      console.log('Document migrated successfully')
    }

    // Migrate versions
    const versions = await db.collection('versions').find({}).toArray()
    console.log(`\nFound ${versions.length} versions to migrate`)

    for (const version of versions) {
      console.log(`\nMigrating version: ${version._id}`)
      
      // Skip if already migrated
      if (version.content?.type === 'yjs') {
        console.log('Version already in YJS format, skipping...')
        continue
      }

      // Create YDoc and insert content
      const ydoc = new Y.Doc()
      const ytext = ydoc.getText('content')
      
      if (typeof version.content === 'string') {
        ytext.insert(0, version.content)
      } else {
        ytext.insert(0, JSON.stringify(version.content))
      }

      // Update version with YJS state
      await db.collection('versions').updateOne(
        { _id: version._id },
        {
          $set: {
            content: {
              type: 'yjs',
              state: Array.from(Y.encodeStateAsUpdate(ydoc))
            }
          }
        }
      )
      console.log('Version migrated successfully')
    }

    console.log('\n=== Migration Complete ===')
  },

  async down(db) {
    console.log('\n=== Rolling Back YJS Migration ===')
    
    // This is a best-effort rollback - it will convert YJS content back to string
    // but won't restore the exact original format
    
    // Rollback documents
    const documents = await db.collection('documents').find({
      'content.type': 'yjs'
    }).toArray()
    console.log(`Found ${documents.length} documents to rollback`)

    for (const doc of documents) {
      console.log(`\nRolling back document: ${doc._id}`)
      
      try {
        // Create YDoc and apply state
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(doc.content.state))
        const ytext = ydoc.getText('content')
        
        // Try to parse the content as JSON, fallback to string if not valid
        let content
        try {
          content = JSON.parse(ytext.toString())
        } catch {
          content = ytext.toString()
        }

        // Update document with original content
        await db.collection('documents').updateOne(
          { _id: doc._id },
          { $set: { content } }
        )
        console.log('Document rolled back successfully')
      } catch (error) {
        console.error('Error rolling back document:', error)
      }
    }

    // Rollback versions
    const versions = await db.collection('versions').find({
      'content.type': 'yjs'
    }).toArray()
    console.log(`\nFound ${versions.length} versions to rollback`)

    for (const version of versions) {
      console.log(`\nRolling back version: ${version._id}`)
      
      try {
        // Create YDoc and apply state
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(version.content.state))
        const ytext = ydoc.getText('content')
        
        // Try to parse the content as JSON, fallback to string if not valid
        let content
        try {
          content = JSON.parse(ytext.toString())
        } catch {
          content = ytext.toString()
        }

        // Update version with original content
        await db.collection('versions').updateOne(
          { _id: version._id },
          { $set: { content } }
        )
        console.log('Version rolled back successfully')
      } catch (error) {
        console.error('Error rolling back version:', error)
      }
    }

    console.log('\n=== Rollback Complete ===')
  }
} 