# Dialogue Detection System Refactoring Tasks

## Utility Functions Creation

- [x] Create `lib/utils/dialogue-utils.ts`
- [x] Extract `processDialogueDetectionResult` function
- [x] Extract `getConfirmedMarksFromDoc` function
- [x] Extract `applyDialogueMarks` function
- [x] Extract `preserveConfirmedMarks` function
- [x] Extract `processAndGroupDialogueMarks` functions
  - [x] Extract `processDialogueMarks` function
  - [x] Extract `groupDialogueMarks` function
- [x] Extract `getBaseConversationDisplay` function

## Test Setup

- [x] Create `__tests__/dialogue-utils.test.ts`
- [x] Create sample document data
- [x] Create sample dialogue detection API responses
- [x] Create helper function to initialize Tiptap editor for tests

## Unit Tests

- [x] Write tests for `getConfirmedMarksFromDoc`
- [x] Write tests for `processDialogueDetectionResult`
- [x] Write tests for `applyDialogueMarks`
- [x] Write tests for `preserveConfirmedMarks`
- [x] Write tests for `processDialogueMarks`
- [x] Write tests for `groupDialogueMarks`
- [x] Write tests for `getBaseConversationDisplay`

## Integration Tests

- [ ] Create `__tests__/dialogue-detection.test.ts`
- [ ] Write test for complete dialogue detection flow
- [ ] Test edge cases (empty document, malformed responses, etc.)

## Hook Refactoring

- [ ] Update `useDialogueSync` to use utility functions
- [ ] Update `useDialogueConfirmation` if needed
- [ ] Update any other hooks that can benefit from utility functions

## Validation

- [ ] Verify tests pass
- [ ] Check that all original functionality is preserved
- [ ] Document any discovered bugs in highlighting

## Status

- Current task: Creating an integration test for the complete dialogue detection flow
