# Chat Entity References

This document explains how chat entity references work in the Draft Editor application and how to extend the system to support new entity types.

## Overview

The application allows users to reference different types of entities in chat messages. When a user references an entity, its content is extracted and included as context for the AI's response. This enables the AI to have awareness of documents, conversations, folders, and other content when generating replies.

## Current Entity Types

The system currently supports the following entity types:

1. **Document** - References a specific document and includes its content as context
2. **Conversation** - References a conversation from a document and includes its dialogue as context
3. **Scene** - References a scene from a document
4. **Folder** - References a folder and includes all immediate document children as context

## How Entity References Work

The flow for entity references is as follows:

1. User types `@` in the chat input to trigger entity selection
2. The EntitySelector component displays available entity types
3. User selects an entity type, then a specific entity
4. The selected entity reference is stored with the message
5. When sending the message, the `prepareEntityContents` function in `chat-panel.tsx` processes each reference:
   - Loads the relevant content for each entity type
   - Converts content to appropriate format (usually plain text)
   - Adds the content to the context payload sent to the AI

## Adding a New Entity Type

To add support for a new entity type, you need to:

1. **Update Entity Type System**:

   ```typescript
   // In providers.tsx
   export type EntityType = 'document' | 'conversation' | 'scene' | 'folder' | 'your-new-type'

   interface YourNewEntity extends Entity {
     type: 'your-new-type'
     // Add specific properties needed for your entity
   }

   export type AnyEntity = DocumentEntity | ConversationEntity | SceneEntity | FolderEntity | YourNewEntity
   ```

2. **Add to EntityContextType**:

   ```typescript
   // In providers.tsx
   interface EntityContextType {
     entities: {
       // Existing entity arrays
       yourNewEntities: YourNewEntity[]
     }
     // Add any functions needed to load/manage your entity
     loadYourNewEntityContent: (entityId: string) => Promise<YourContentType>
   }
   ```

3. **Implement Entity Provider**:

   - Add state for your entity type in EntityProvider
   - Add fetching and processing logic
   - Implement the content loading function

4. **Update UI Components**:

   - Add an icon for your entity type in EntitySelector
   - Ensure your entity type appears in the selection UI

5. **Add Content Processing Logic**:

   - Update `prepareEntityContents` in `chat-panel.tsx` to handle your entity type:

   ```typescript
   // In chat-panel.tsx
   if (ref.type === 'your-new-type') {
     // Load entity content using your custom loader function
     const entityContent = await loadYourNewEntityContent(ref.id)

     // Process the content into a format suitable for the AI
     const processedContent = processYourEntityContent(entityContent)

     // Add to entity contents with appropriate key
     entityContents[`your-new-type:${ref.id}`] = {
       type: 'your-new-type',
       id: ref.id,
       name: ref.displayName,
       // Add any other metadata needed
       content: processedContent,
     }
   }
   ```

## Example: Adding Character Entity Type

Here's a concrete example of adding support for character entities:

1. **Update Entity Types**:

   ```typescript
   export type EntityType = 'document' | 'conversation' | 'scene' | 'folder' | 'character'

   interface CharacterEntity extends Entity {
     type: 'character'
     characterId: string
     biography?: string
   }
   ```

2. **Add Context Functions**:

   ```typescript
   interface EntityContextType {
     // Add to entities object
     entities: {
       // Existing types...
       characters: CharacterEntity[]
     }
     // Add loading function
     loadCharacterContent: (characterId: string) => Promise<CharacterEntity | undefined>
   }
   ```

3. **Update prepareEntityContents in chat-panel.tsx**:

   ```typescript
   else if (ref.type === 'character') {
     const characterWithContent = await loadCharacterContent(ref.id);

     if (characterWithContent) {
       entityContents[`character:${ref.id}`] = {
         type: 'character',
         id: ref.id,
         name: ref.displayName,
         biography: characterWithContent.biography || '',
         // Add any other character data
       };
     }
   }
   ```

## Best Practices

1. **Content Loading**: Keep content loading logic in the EntityProvider
2. **Performance**: Consider using `metadataOnly` where appropriate to avoid loading full content until needed
3. **Error Handling**: Always handle errors gracefully in content loading functions
4. **Formatting**: Convert complex content into plain text or structured format the AI can understand
5. **Logging**: Add appropriate console logs during development to track entity loading and processing

## Debugging Tips

If an entity reference isn't working as expected:

1. Add console logs to track entity selection in `chat-input.tsx`
2. Add console logs in the entity loading function to verify the entity is found
3. Add logs in `prepareEntityContents` to check if the content is being successfully loaded
4. Verify the entity appears correctly in the API payload

Remember to update the appropriate TypeScript types when adding new entity types to maintain type safety throughout the application.
