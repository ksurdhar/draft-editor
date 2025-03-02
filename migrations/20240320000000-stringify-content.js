module.exports = {
  async up(db) {
    console.log('\n=== Starting Migration to Stringify Content ===')
    
    // Find documents with object content
    const documents = await db.collection('documents').find({
      content: { $type: 'object' }
    }).toArray()
    
    console.log(`Found ${documents.length} documents with object content to stringify`)
    
    let processed = 0
    let success = 0
    let failed = 0
    
    // Process each document
    for (const doc of documents) {
      processed++
      console.log(`\nProcessing document ${processed}/${documents.length}: ${doc._id}`)
      
      try {
        // Stringify the content
        const stringifiedContent = JSON.stringify(doc.content)
        
        // Update the document
        await db.collection('documents').updateOne(
          { _id: doc._id },
          { $set: { content: stringifiedContent } }
        )
        
        console.log('Document content stringified successfully')
        success++
      } catch (error) {
        console.error('Error stringifying document content:', error)
        failed++
      }
    }
    
    // Also process versions collection
    const versions = await db.collection('versions').find({
      content: { $type: 'object' }
    }).toArray()
    
    console.log(`\nFound ${versions.length} versions with object content to stringify`)
    
    let processedVersions = 0
    let successVersions = 0
    let failedVersions = 0
    
    // Process each version
    for (const version of versions) {
      processedVersions++
      console.log(`\nProcessing version ${processedVersions}/${versions.length}: ${version._id}`)
      
      try {
        // Stringify the content
        const stringifiedContent = JSON.stringify(version.content)
        
        // Update the version
        await db.collection('versions').updateOne(
          { _id: version._id },
          { $set: { content: stringifiedContent } }
        )
        
        console.log('Version content stringified successfully')
        successVersions++
      } catch (error) {
        console.error('Error stringifying version content:', error)
        failedVersions++
      }
    }
    
    console.log('\n=== Migration Summary ===')
    console.log(`Documents: ${success} succeeded, ${failed} failed out of ${documents.length}`)
    console.log(`Versions: ${successVersions} succeeded, ${failedVersions} failed out of ${versions.length}`)
    console.log('\n=== Migration Complete ===')
  },

  async down(db) {
    console.log('\n=== Rolling Back Stringify Content Migration ===')
    console.log('Note: This is a best-effort rollback that will attempt to parse stringified content')
    
    // Find documents with string content that looks like JSON
    const documents = await db.collection('documents').find({
      content: { 
        $type: 'string',
        $regex: /^\s*\{.*\}\s*$/s
      }
    }).toArray()
    
    console.log(`Found ${documents.length} documents with stringified content to parse`)
    
    let processed = 0
    let success = 0
    let failed = 0
    
    // Process each document
    for (const doc of documents) {
      processed++
      console.log(`\nProcessing document ${processed}/${documents.length}: ${doc._id}`)
      
      try {
        // Try to parse the content
        const parsedContent = JSON.parse(doc.content)
        
        // Update the document
        await db.collection('documents').updateOne(
          { _id: doc._id },
          { $set: { content: parsedContent } }
        )
        
        console.log('Document content parsed successfully')
        success++
      } catch (error) {
        console.error('Error parsing document content:', error)
        failed++
      }
    }
    
    // Also process versions collection
    const versions = await db.collection('versions').find({
      content: { 
        $type: 'string',
        $regex: /^\s*\{.*\}\s*$/s
      }
    }).toArray()
    
    console.log(`\nFound ${versions.length} versions with stringified content to parse`)
    
    let processedVersions = 0
    let successVersions = 0
    let failedVersions = 0
    
    // Process each version
    for (const version of versions) {
      processedVersions++
      console.log(`\nProcessing version ${processedVersions}/${versions.length}: ${version._id}`)
      
      try {
        // Try to parse the content
        const parsedContent = JSON.parse(version.content)
        
        // Update the version
        await db.collection('versions').updateOne(
          { _id: version._id },
          { $set: { content: parsedContent } }
        )
        
        console.log('Version content parsed successfully')
        successVersions++
      } catch (error) {
        console.error('Error parsing version content:', error)
        failedVersions++
      }
    }
    
    console.log('\n=== Rollback Summary ===')
    console.log(`Documents: ${success} succeeded, ${failed} failed out of ${documents.length}`)
    console.log(`Versions: ${successVersions} succeeded, ${failedVersions} failed out of ${versions.length}`)
    console.log('\n=== Rollback Complete ===')
  }
} 