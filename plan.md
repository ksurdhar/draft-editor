# Dialogue Detection System Refactoring and Testing Plan

## Current System Analysis

The dialogue detection system consists of these key components:

1. **DialogueMark Extension** (`dialogue-mark.ts`):

   - Defines a custom Tiptap mark for dialogue
   - Contains attributes: character, conversationId, conversationName, userConfirmed
   - Provides commands to set/unset marks and update conversation names

2. **Dialogue Hooks** (`dialogue-hooks.ts`):

   - `useDialogueConfirmation`: Manages confirming dialogue marks
   - `useDialogueSync`: Complex core logic for API communication and mark application
   - `useDialogueHighlight`: Controls highlighting behavior
   - `useRemoveAllDialogueMarks`: Utility for removing all marks
   - `useConversationRename`: Handles conversation renaming
   - `useDialogue`: Combines all hooks for easy consumption

3. **Dialogue List Component** (`dialogue-list.tsx`):

   - UI for displaying detected dialogue
   - Groups dialogue by conversation
   - Allows confirmation and focus of dialogue
   - Contains complex logic for processing marks from the document

4. **Editor Component** (`editor.tsx`):
   - Integrates all dialogue extensions and components
   - Initializes the Tiptap editor with required extensions

## Identified Issues

- Logic is tightly coupled with React hooks, making testing difficult
- Complex code in useDialogueSync that's hard to test and debug
- Highlighting bugs occur when applying dialogue marks
- No unit tests for dialogue detection logic

## Refactoring Approach

1. **Extract Pure Functions**:

   - Move core logic from hooks and components to pure utility functions
   - Make these functions independently testable
   - Keep React hooks as thin wrappers around utility functions

2. **Create Utility File**:

   - New file: `lib/dialogue-utils.ts`
   - Will contain all extracted pure functions
   - Functions should take explicit inputs and return outputs without side effects

3. **Key Functions to Extract**:

   - `processDialogueDetectionResult`: Process API response
   - `applyDialogueMarks`: Apply marks to the document
   - `getConfirmedMarksFromDoc`: Extract confirmed marks from document
   - `preserveConfirmedMarks`: Ensure confirmed marks aren't lost
   - `processAndGroupDialogueMarks`: Extract and group marks by conversation

4. **Update Existing Code**:
   - Modify hooks to use the new utility functions
   - Maintain the same API to avoid breaking changes
   - Remove duplicated logic

## Testing Strategy

1. **Create Test Directory**:

   - Place tests in `__tests__/` at project root

2. **Test File Structure**:

   - `__tests__/dialogue-utils.test.ts`: Unit tests for utility functions
   - `__tests__/dialogue-detection.test.ts`: Integration tests for the full flow

3. **Test Approach**:

   - Create real Tiptap editor instances (not mocks)
   - Define sample document content with text nodes
   - Create sample dialogue detection API responses
   - Test each utility function independently
   - Test the complete flow from API response to document update
   - Include edge cases and error conditions

4. **Testing Environment**:
   - Check if 'jsdom' environment is needed instead of 'node'
   - Ensure DOM is available for Tiptap testing
   - Use the project's existing TypeScript and module resolution setup

## Implementation Plan

1. Create `lib/dialogue-utils.ts` with extracted functions
2. Create test files with sample data
3. Write unit tests for each utility function
4. Update hooks to use utility functions
5. Write integration tests for the full flow
6. Validate test coverage
7. Fix identified highlighting bugs

This approach will make the code more maintainable, easier to test, and help isolate issues in the highlighting functionality.
