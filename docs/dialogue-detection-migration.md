# Dialogue Detection Migration

This document explains the migration of dialogue detection functionality from the Electron app to the Next.js API.

## Architecture Changes

### Before Migration

- Dialogue detection was performed directly in the Electron app
- Used the `electron/services/dialogue-detection.ts` service
- Made direct OpenAI API calls from the Electron process
- Required OpenAI API key to be available in the Electron environment

### After Migration

- Dialogue detection is now performed via the Next.js API
- The Electron app calls the `/api/ai/dialogue` endpoint
- OpenAI API calls are made from the Next.js server
- OpenAI API key only needs to be available in the Next.js environment
- Endpoint is protected with hybrid authentication (same as other API endpoints)

## Implementation Details

The migration involved the following changes:

1. **Updated the dialogue detection handler in the Electron app**:

   - Modified to call the Next.js API endpoint instead of the local service
   - Added fallback to local detection in case of network issues
   - Ensured response format remains compatible with existing code

2. **Updated request routing**:

   - Modified `makeRequest` function to allow dialogue detection requests to go to the cloud
   - Maintained the same API interface for clients

3. **Implemented hybrid authentication**:
   - Used the `withHybridAuth` wrapper for consistent authentication across all API endpoints
   - Added proper user validation and error handling
   - Implemented detailed logging for auth failures and successful operations

## Authentication

The dialogue detection endpoint now uses the same hybrid authentication approach as other API endpoints:

- Supports both token-based authentication (for Electron) and session-based authentication (for web)
- Validates user identity before processing any requests
- Consistent with the rest of the application's API endpoints
- Maintains proper security controls across all platforms

## Benefits

- **Centralized Logic**: All dialogue detection code now lives in one place
- **Easier Maintenance**: Updates and improvements only need to be made in the Next.js API
- **Reduced Dependencies**: Electron app no longer needs direct access to OpenAI API
- **Consistency**: Same implementation for both web and Electron apps
- **Secure Access**: Protected by the same authentication mechanisms as other endpoints

## Fallback Mechanism

For offline scenarios, the Electron app still maintains a fallback to the local dialogue detection service:

1. It first attempts to use the Next.js API
2. If that fails due to network issues, it falls back to the local service
3. This ensures functionality even when offline

## Future Improvements

- Add caching for dialogue detection results
- Implement optimizations for handling very large texts
- Add more dialogue analysis features (easier now with centralized API)
