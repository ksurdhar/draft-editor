# Hybrid Development Patterns: Supporting Features Across Electron and Next.js

This document outlines patterns and best practices for developing features that work seamlessly across both the Electron desktop application and the Next.js web application.

## Core Principles

1. **Environment-Aware Components**: Create components that can detect and adapt to their environment
2. **Shared Business Logic**: Keep core business logic environment-agnostic
3. **Conditional API Access**: Use the appropriate API access method based on environment
4. **Graceful Degradation**: Handle features that may not be fully supported in web environments

## Environment Detection

The fundamental pattern for hybrid development is environment detection:

```typescript
// Check if running in Electron environment
const isElectron = typeof window !== 'undefined' && window.electronAPI
```

This allows components to modify their behavior based on the runtime environment.

## API Access Patterns

### Conditional API Access

When fetching data, use an environment-appropriate API accessor:

```typescript
// In a shared component
const fetcher = isElectron ? window.electronAPI.get : get
const { data, error } = useSWR('/api/endpoint', fetcher)
```

This pattern allows components to use the same data fetching logic regardless of environment.

### API Endpoint Structure

1. **Next.js API Endpoints**: Implement API logic in `/pages/api/*` routes
2. **Electron API Service**: Configure Electron to call Next.js API endpoints
3. **Shared Types**: Use common type definitions for request/response data

### Authentication

Use the hybrid authentication pattern implemented with `withHybridAuth`:

```typescript
// In a Next.js API endpoint
export default withHybridAuth(async function handler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { user } = req

  if (!user) {
    return res.status(401).end('Unauthorized')
  }

  // Handler logic here
})
```

This supports both token-based auth (Electron) and session-based auth (web).

## Component Architecture

### Shared Components

For components that need to work in both environments:

1. Place them in the `/components` directory
2. Use environment detection for conditional rendering/behavior
3. Use conditional hooks based on environment

```typescript
// Example of conditional effects
useEffect(() => {
  if (!isElectron) return // Skip in web environment

  // Electron-specific side effect
  const unsubscribe = window.electronAPI.onSyncUpdate(handleSyncUpdate)
  return () => unsubscribe()
}, [])
```

### Next.js Page Structure

For Next.js pages that use shared components:

```typescript
'use client'

import { withPageAuthRequired } from '@wrappers/auth-wrapper-client';
import SharedComponent from '@components/path/to/shared-component';

function WebPage() {
  return <SharedComponent />;
}

export default withPageAuthRequired(WebPage);
```

This pattern:

- Uses the `'use client'` directive for client-side rendering
- Handles authentication for the web context
- Directly uses the shared component

## Handling Platform-Specific Features

### Offline Support

For features that need offline support in Electron:

1. Implement primary functionality in the Next.js API
2. Add fallback handling in Electron for offline scenarios

Example: Dialogue Detection

```typescript
try {
  // Try to use the Next.js API
  const response = await performCloudOperation('post', '/api/ai/dialogue', data)
  return response.data
} catch (error) {
  if (isNetworkError(error)) {
    // Fallback to local implementation when offline
    return await localImplementation(data)
  }
  throw error
}
```

### Storage

For storage operations:

1. Use environment-specific storage adapters with a common interface
2. In Electron: Use local filesystem with cloud sync when online
3. In Web: Use direct API calls to backend storage

## Testing

1. Test components in both environments
2. Mock environment-specific APIs for consistent testing
3. Use environment detection in tests to skip irrelevant tests

## Styling

1. Use responsive designs that work on both web and desktop
2. Account for different window behaviors (resizable in Electron)
3. Use Tailwind CSS for consistent styling across platforms

## Real-World Example: Conversations Page

The Conversations page exemplifies these patterns:

1. Core component in `components/conversations/conversations-page.tsx`:

   - Uses `isElectron` to detect environment
   - Conditionally accesses APIs
   - Handles Electron-specific side effects safely

2. Next.js route in `app/conversations/page.tsx`:
   - Uses the `withPageAuthRequired` HOC for web auth
   - Imports the shared component directly

This approach ensures consistent functionality while leveraging the strengths of each platform.

## Best Practices Summary

1. **Start with web-first development** - Ensure features work on web before adding Electron-specific enhancements
2. **Use feature detection** - Check for capabilities rather than platforms when possible
3. **Share business logic** - Keep core logic platform-agnostic
4. **Add offline support thoughtfully** - Design for offline use from the beginning
5. **Maintain type consistency** - Use shared types across platforms
6. **Document platform differences** - Make limitations and differences clear for users
