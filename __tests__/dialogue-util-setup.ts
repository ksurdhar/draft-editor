import { DialogueDetection, ProcessedDialogueMark } from '../lib/utils/dialogue-utils'

const sampleDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is a sample document with dialogue.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'John: Hello there!',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: true,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Sarah: Hi John, how are you today?',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'Sarah',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: false,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is not dialogue.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'John: I am doing well, thanks for asking!',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: false,
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Michael: Hello everyone, this is a different conversation.',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'Michael',
                conversationId: 'test-doc-conv2',
                conversationName: null,
                userConfirmed: true,
              },
            },
          ],
        },
      ],
    },
  ],
}

// Sample document with adjacent dialogue nodes
const sampleDocumentWithAdjacentDialogue = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is a sample document with adjacent dialogue nodes.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'John: This is part 1',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: true,
              },
            },
          ],
        },
        {
          type: 'text',
          text: " of John's dialogue.",
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: true,
              },
            },
          ],
        },
      ],
    },
  ],
}

// Sample document with no confirmed marks
const sampleDocumentNoConfirmed = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is a sample document with dialogue.',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'John: Hello there!',
          marks: [
            {
              type: 'dialogue',
              attrs: {
                character: 'John',
                conversationId: 'test-doc-conv1',
                conversationName: 'Greeting',
                userConfirmed: false,
              },
            },
          ],
        },
      ],
    },
  ],
}

// Sample dialogue detection response from API
const sampleDetectedDialogues: DialogueDetection[] = [
  {
    character: 'John',
    snippet: 'John: Hello there!',
    conversationId: 'conv1',
  },
  {
    character: 'Sarah',
    snippet: 'Sarah: Hi John, how are you today?',
    conversationId: 'conv1',
  },
  {
    character: 'John',
    snippet: 'John: I am doing well, thanks for asking!',
    conversationId: 'conv1',
  },
  {
    character: 'Michael',
    snippet: 'Michael: Hello everyone, this is a different conversation.',
    conversationId: 'conv2',
  },
  {
    character: 'Lisa',
    snippet: 'Lisa: This is a new line of dialogue not in the document yet.',
    conversationId: 'conv1',
  },
]

// Sample processed dialogues
const sampleProcessedDialogues = [
  {
    character: 'John',
    snippet: 'John: Hello there!',
    conversationId: 'conv1',
    uniqueConversationId: 'test-doc-conv1',
    conversationName: 'Greeting Conversation',
  },
  {
    character: 'Sarah',
    snippet: 'Sarah: Hi John, how are you today?',
    conversationId: 'conv1',
    uniqueConversationId: 'test-doc-conv1',
    conversationName: 'Greeting Conversation',
  },
  {
    character: 'Lisa',
    snippet: 'Lisa: This is a new line of dialogue not in the document yet.',
    conversationId: 'conv1',
    uniqueConversationId: 'test-doc-conv1',
    conversationName: 'Greeting Conversation',
  },
]

// Sample processed dialogue marks
const sampleProcessedMarks: ProcessedDialogueMark[] = [
  {
    id: '60-80',
    character: 'John',
    content: 'John: Hello there!',
    conversationId: 'test-doc-conv1',
    conversationName: 'Greeting',
    userConfirmed: true,
  },
  {
    id: '100-135',
    character: 'Sarah',
    content: 'Sarah: Hi John, how are you today?',
    conversationId: 'test-doc-conv1',
    conversationName: 'Greeting',
    userConfirmed: false,
  },
  {
    id: '180-220',
    character: 'John',
    content: 'John: I am doing well, thanks for asking!',
    conversationId: 'test-doc-conv1',
    conversationName: 'Greeting',
    userConfirmed: false,
  },
  {
    id: '240-300',
    character: 'Michael',
    content: 'Michael: Hello everyone, this is a different conversation.',
    conversationId: 'test-doc-conv2',
    conversationName: null,
    userConfirmed: true,
  },
]

export {
  sampleDocument,
  sampleDocumentWithAdjacentDialogue,
  sampleDocumentNoConfirmed,
  sampleDetectedDialogues,
  sampleProcessedDialogues,
  sampleProcessedMarks,
}
