import SyncService from '../electron/sync-service'

// Access the mergeContent method directly since it's now public
const syncService = SyncService

describe('mergeContent', () => {
  it('should handle string inputs by parsing them', () => {
    const content1 = JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Content 1' }]
      }]
    })
    const content2 = JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Content 2' }]
      }]
    })

    const result = syncService.mergeContent(content1, content2)
    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Content 1' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Content 2' }]
        }
      ]
    })
  })

  it('should preserve initial content from first document', () => {
    const content1 = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Initial content' }]
      }]
    }
    const content2 = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Different initial content' }]
      }]
    }

    const result = syncService.mergeContent(content1, content2)
    expect(result.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Initial content' }]
    })
  })

  it('should preserve both local and remote changes', () => {
    const content1 = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Initial content' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Local addition' }]
        }
      ]
    }
    const content2 = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Initial content' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Remote addition' }]
        }
      ]
    }

    const result = syncService.mergeContent(content1, content2)
    expect(result).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Initial content' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Local addition' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Remote addition' }]
        }
      ]
    })
  })

  it('should handle empty content arrays', () => {
    const content1 = {
      type: 'doc',
      content: []
    }
    const content2 = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Some content' }]
      }]
    }

    const result = syncService.mergeContent(content1, content2)
    expect(result).toEqual({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Some content' }]
      }]
    })
  })

  it('should handle invalid document types by returning second content', () => {
    const content1 = {
      type: 'invalid',
      content: []
    }
    const content2 = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Valid content' }]
      }]
    }

    const result = syncService.mergeContent(content1, content2)
    expect(result).toEqual(content2)
  })

  it('should deduplicate identical paragraphs', () => {
    const content1 = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Duplicate content' }]
        }
      ]
    }
    const content2 = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Duplicate content' }]
        }
      ]
    }

    const result = syncService.mergeContent(content1, content2)
    expect(result.content).toHaveLength(1)
    expect(result.content[0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Duplicate content' }]
    })
  })

  it('should preserve paragraph order (local changes before remote)', () => {
    const content1 = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second (Local)' }]
        }
      ]
    }
    const content2 = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Third (Remote)' }]
        }
      ]
    }

    const result = syncService.mergeContent(content1, content2)
    expect(result.content.map((p: { content: Array<{ text: string }> }) => p.content[0].text)).toEqual([
      'First',
      'Second (Local)',
      'Third (Remote)'
    ])
  })
}) 