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
    console.log('\n=== Rolling Back YJS Migration to TipTap JSON ===')
    
    // Rollback documents
    const documentsQuery = { 'content.type': 'yjs' }
    const documentCount = await db.collection('documents').countDocuments(documentsQuery)
    console.log(`Found ${documentCount} documents to rollback to TipTap JSON format`)

    const documentCursor = db.collection('documents').find(documentsQuery)
    let processedDocs = 0
    let successDocs = 0
    let failedDocs = 0

    while (await documentCursor.hasNext()) {
      const doc = await documentCursor.next()
      processedDocs++
      console.log(`\nRolling back document ${processedDocs}/${documentCount}: ${doc._id}`)
      
      try {
        if (!doc.content || !Array.isArray(doc.content.state)) {
          console.log('Invalid YJS state format, skipping...')
          failedDocs++
          continue
        }

        // Convert YJS state back to content
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(doc.content.state))
        const ytext = ydoc.getText('content')
        const contentStr = ytext.toString()
        
        // Try to parse content as JSON first (TipTap structure)
        let content
        try {
          content = JSON.parse(contentStr)
          // Validate that this looks like a TipTap document
          if (!content.type && !content.content) {
            // If it doesn't have typical TipTap structure, keep as string
            console.log('Content parsed as JSON but doesn\'t look like TipTap structure - storing as parsed JSON anyway')
          }
        } catch (e) {
          // If not valid JSON, store as string
          console.log('Content is not valid JSON, storing as string')
          content = contentStr
        }

        // Update document with original content format
        await db.collection('documents').updateOne(
          { _id: doc._id },
          { $set: { content } }
        )
        console.log('Document rolled back successfully')
        successDocs++
      } catch (error) {
        console.error('Error rolling back document:', error)
        failedDocs++
      }
    }

    // Rollback versions
    const versionsQuery = { 'content.type': 'yjs' }
    const versionCount = await db.collection('versions').countDocuments(versionsQuery)
    console.log(`\nFound ${versionCount} versions to rollback`)

    const versionCursor = db.collection('versions').find(versionsQuery)
    let processedVersions = 0
    let successVersions = 0
    let failedVersions = 0

    while (await versionCursor.hasNext()) {
      const version = await versionCursor.next()
      processedVersions++
      console.log(`\nRolling back version ${processedVersions}/${versionCount}: ${version._id}`)
      
      try {
        if (!version.content || !Array.isArray(version.content.state)) {
          console.log('Invalid YJS state format, skipping...')
          failedVersions++
          continue
        }

        // Convert YJS state back to content
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(version.content.state))
        const ytext = ydoc.getText('content')
        const contentStr = ytext.toString()
        
        // Try to parse content as JSON first (TipTap structure)
        let content
        try {
          content = JSON.parse(contentStr)
          // Validate that this looks like a TipTap document
          if (!content.type && !content.content) {
            // If it doesn't have typical TipTap structure, keep as string
            console.log('Content parsed as JSON but doesn\'t look like TipTap structure - storing as parsed JSON anyway')
          }
        } catch (e) {
          // If not valid JSON, store as string
          console.log('Content is not valid JSON, storing as string')
          content = contentStr
        }

        // Update version with original content format
        await db.collection('versions').updateOne(
          { _id: version._id },
          { $set: { content } }
        )
        console.log('Version rolled back successfully')
        successVersions++
      } catch (error) {
        console.error('Error rolling back version:', error)
        failedVersions++
      }
    }

    console.log('\n=== Rollback Summary ===')
    console.log(`Documents: ${successDocs} succeeded, ${failedDocs} failed out of ${documentCount}`)
    console.log(`Versions: ${successVersions} succeeded, ${failedVersions} failed out of ${versionCount}`)
    console.log('\n=== Rollback Complete ===')
  }
} 