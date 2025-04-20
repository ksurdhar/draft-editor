# Entity Reference Feature Plan Overview

## Goal

Implement an entity reference feature in the chat panel that allows users to reference documents, conversations, and scenes using "@" mentions. This will enable users to provide context to the AI by referencing specific content within the application.

## Architecture Overview

### 1. Entity Context Provider

Create a global context provider that stores and provides access to all referenceable entities (documents, conversations, scenes) throughout the application.

- Fetch and cache entities using SWR
- Provide filtering capabilities
- Keep entities in sync with server state
- Make available across all pages, not just the conversations page

### 2. Mention Detection System

Enhance the chat input to detect and process "@" mentions:

- Track when user types "@" character
- Display entity type selection (document, conversation, scene)
- Track user input for filtering entities
- Handle keyboard navigation and selection

### 3. Entity Selector UI

Create a dropdown component that appears when a user is creating a mention:

- Two-level selection: entity type first, then specific entity
- Filtering based on user input
- Keyboard navigation support
- Visual styling consistent with app design

### 4. Entity Reference Data Structure

Define how entity references are stored and transmitted:

```typescript
interface EntityReference {
  type: 'document' | 'conversation' | 'scene'
  id: string
  displayName: string
  parentId?: string
  parentType?: 'document'
}
```

### 5. Message Integration

Update the chat message system to handle entity references:

- Include references in message data structure
- Display references distinctly in UI
- Handle reference editing and deletion
- Transmit references to API

### 6. API Integration

Enhance the API to process entity references:

- Extract relevant context from referenced entities
- Include context in completion requests
- Handle missing or invalid references
- Manage context window size limitations

## Implementation Approach

We'll implement this feature incrementally, with each phase building on the previous one:

1. **Entity Context**: Set up the global entity provider
2. **Mention Detection**: Implement "@" detection and initial UI
3. **Entity Selector**: Build the selector component and selection logic
4. **Message Integration**: Update message handling for references
5. **API Integration**: Connect with backend completion API

## Success Criteria

- Users can reference documents, conversations, and scenes using "@" mentions
- Entity selector filters results as user types
- Selected entities are included in messages as references, not just text
- AI responses incorporate context from referenced entities
- System performs well even with large numbers of entities
