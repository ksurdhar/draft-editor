const fs = require('fs')

function isTipTapFormat(content) {
  try {
    const parsed = JSON.parse(content)
    // Check if it's an array (Slate format) vs an object with type: 'doc' (TipTap format)
    if (Array.isArray(parsed)) {
      return false
    }
    // Check for TipTap structure
    if (parsed.type !== 'doc' || !Array.isArray(parsed.content)) {
      return false
    }

    // Check that all paragraph nodes have correct structure
    return parsed.content.every(node => {
      if (node.type !== 'paragraph') return false
      // Empty paragraphs should not have content array
      if (!node.content) return true
      // Non-empty paragraphs should have text nodes
      return (
        Array.isArray(node.content) &&
        node.content.every(textNode => textNode.type === 'text' && typeof textNode.text === 'string')
      )
    })
  } catch (e) {
    return false
  }
}

function convertSlateToTipTap(content) {
  try {
    // Parse content if it's a string, otherwise use as is
    const slateContent = typeof content === 'string' ? JSON.parse(content) : content

    // Convert from Slate format
    const slateNodes = Array.isArray(slateContent) ? slateContent : [slateContent]

    // Create TipTap document structure
    const tipTapDoc = {
      type: 'doc',
      content: slateNodes
        .map(node => {
          if (node.type === 'default' || node.type === 'paragraph') {
            // For empty paragraphs or those without text content
            if (!node.children?.length || node.children.every(child => !child.text)) {
              return { type: 'paragraph' }
            }

            // Convert Slate block to TipTap paragraph with content
            return {
              type: 'paragraph',
              content: node.children.map(child => ({
                type: 'text',
                text: child.text,
                ...(child.highlight && child.highlight !== 'none'
                  ? {
                      marks: [
                        {
                          type: 'highlight',
                          attrs: { color: child.highlight },
                        },
                      ],
                    }
                  : {}),
              })),
            }
          }
          return null
        })
        .filter(Boolean),
    }

    return JSON.stringify(tipTapDoc)
  } catch (e) {
    console.error('Conversion failed:', e)
    console.error('Failed content:', content)
    return null
  }
}

// Read the backup database
console.log('Reading backup database...')
const backupPath = process.argv[2] || 'data/db.backup.json'
const outputPath = process.argv[3] || 'data/db.json'

if (!fs.existsSync(backupPath)) {
  console.error(`Backup file not found at ${backupPath}`)
  process.exit(1)
}

const db = JSON.parse(fs.readFileSync(backupPath, 'utf8'))

// Convert each document
console.log(`Converting ${db.documents.length} documents from ${backupPath}...`)
db.documents = db.documents.map((doc, index) => {
  if (index === 0) {
    // Only log details for the first document
    console.log('\n=== Detailed logging for first document ===')
    console.log('Document title:', doc.title)
    console.log('Original content:', doc.content)
  }

  if (!doc.content) {
    if (index === 0) console.log('No content to convert')
    return doc
  }

  const convertedContent = convertSlateToTipTap(doc.content)
  if (convertedContent) {
    if (index === 0) {
      console.log('\nConverted content:', convertedContent)
      const parsed = JSON.parse(convertedContent)
      console.log('Parsed converted content:', JSON.stringify(parsed, null, 2))
      console.log('=== End detailed logging ===\n')
    } else {
      console.log(`Converting document ${index + 1}: ${doc.title}`)
    }
    return {
      ...doc,
      content: convertedContent,
    }
  } else {
    console.log('Conversion failed, keeping original content')
    return doc
  }
})

// Write to the new database file
console.log(`\nWriting converted database to ${outputPath}...`)
fs.writeFileSync(outputPath, JSON.stringify(db, null, 2))
console.log('Conversion complete!')
