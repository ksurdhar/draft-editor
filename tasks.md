# Entity Reference Feature Tasks

## Phase 1: Entity Context Setup

- [x] Create `EntityContext` in providers.tsx
  - [x] Define context interfaces and types
  - [x] Implement state for documents, conversations, and loading status
  - [x] Create provider component
- [x] Implement entity data fetching using SWR
  - [x] Add fetching logic for documents
  - [x] Add fetching logic for conversations
  - [x] Add logic to extract conversations from documents (using existing logic from conversations-page.tsx)
- [x] Create `useEntity` hook for accessing the context
  - [x] Add methods for filtering entities by type
  - [x] Add methods for searching entities by name
- [x] Add the provider to app's provider hierarchy
  - [x] Update app.tsx or layout.tsx to include the new provider
- [x] Implement entity synchronization
  - [x] Add event listeners for entity updates (for Electron)
  - [x] Add polling or refresh mechanism (for web)
- [x] Test entity context across different pages

## Phase 2: Chat Input Enhancement

- [x] Modify `ChatInput` component to support mentions
  - [x] Add state variables for tracking mention status
  - [x] Implement event handlers for input changes
  - [x] Add logic to detect "@" character
- [x] Create UI indicator for mention mode
  - [x] Style the input differently when in mention mode
  - [x] Add visual cue for active mentions
- [x] Add positioning logic for entity selector
  - [x] Calculate position based on cursor/caret position
  - [x] Handle viewport constraints
- [x] Implement keyboard shortcuts
  - [x] Add support for Escape to cancel mention
  - [x] Add support for Tab/Enter to complete mention
  - [x] Add arrow key navigation (placeholder)
- [x] Test mention detection functionality

## Phase 3: Entity Selector Component

- [x] Create `EntitySelector` component
  - [x] Implement UI for entity type selection
  - [x] Create entity list with filtering
  - [x] Add keyboard navigation support
- [x] Style the component
  - [x] Match existing app design language
  - [x] Add hover and selection states
  - [x] Ensure accessibility
- [x] Implement entity selection logic
  - [x] Handle entity type selection
  - [x] Track and filter by search term
  - [x] Support keyboard and mouse selection
- [x] Add entity insertion functionality
  - [x] Insert selected entity reference into input
  - [x] Format the reference in the input
  - [x] Position cursor after insertion
- [x] Test selector with different entity types and counts

## Phase 4: Entity References in Messages

- [x] Update `Message` type to include entity references
  - [x] Define reference data structure
  - [x] Update message state in chat panel
- [x] Modify `sendMessage` function
  - [x] Parse input for entity references
  - [x] Convert references to proper format for API
- [x] Update `ChatMessage` component
  - [x] Enhance rendering to display entity references
  - [x] Add styling for entity references
  - [ ] Handle missing or invalid references
- [ ] Implement reference interaction
  - [ ] Add tooltips or previews for references
  - [ ] Handle click events on references
- [ ] Test message rendering with references

## Phase 5: API Integration

- [x] Update API payload format
  - [x] Add entity references to request structure
  - [x] Include necessary metadata
- [ ] Modify backend processing
  - [ ] Implement context extraction from referenced entities
  - [ ] Add handling for different entity types
- [ ] Implement error handling
  - [ ] Handle missing or inaccessible entities
  - [ ] Add fallbacks for invalid references
- [ ] Optimize context extraction
  - [ ] Implement smart truncation for large entities
  - [ ] Prioritize relevant sections
- [ ] Test end-to-end functionality
  - [ ] Verify references are properly included in context
  - [ ] Check that AI responses incorporate referenced content
  - [ ] Test with various entity types and combinations

## Enhancements (Future Tasks)

- [ ] Add entity previews when hovering over references
- [ ] Implement entity search optimization for large datasets
- [ ] Add recently used entities section
- [ ] Support inline creation of new entities
- [ ] Enhance styling and animations for entity selection
