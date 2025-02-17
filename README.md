This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

# Document CRUD Operations

This document explains how CRUD (Create, Read, Update, Delete) operations work in the application, from client through to both web and Electron backends.

## Architecture Overview

The application uses a unified API approach through the `useAPI` hook, which abstracts away the differences between web and Electron backends:

```typescript
const { get, post, patch, destroy } = useAPI()
```

For data fetching and caching, we use SWR:

```typescript
const { data: docs, mutate: mutateDocs } = useSWR<DocumentData[]>('/documents', get)
```

## Create Operations

### Creating a Document

Documents are created through the `createDocument` operation:

```typescript
// In document-operations.ts
export const createDocument = async (
  userId: string,
  operations: DocumentOperations,
  onSuccess: (docId: string) => void
) => {
  try {
    const response = await operations.createDocument({ 
      userId,
      title: 'Untitled',
    })
    
    const docId = response.data?._id || response._id
    onSuccess(docId)
    return docId
  } catch (error) {
    console.error('Error creating document:', error)
    throw error
  }
}

// In components:
const handleCreateDocument = async () => {
  if (!user?.sub) return
  await createDocument(
    user.sub,
    operations,
    (docId) => navigateTo(`/documents/${docId}?focus=title`)
  )
}
```

### Creating a Folder

Folders are created directly through the API:

```typescript
const createFolder = async (title: string, parentId?: string) => {
  try {
    const folderData = {
      title,
      parentId: parentId || 'root',
      userId: user?.sub || 'current',
      lastUpdated: Date.now(),
      folderIndex: folders.length
    }

    const response = await post('folders', folderData)
    mutateFolders([...folders, response], false)
  } catch (error) {
    console.error('Error creating folder:', error)
    mutateFolders()
  }
}
```

## Read Operations

Reading data is handled through SWR hooks:

```typescript
// Fetch documents
const { data: docs } = useSWR<DocumentData[]>('/documents', get)

// Fetch folders
const { data: folders } = useSWR<FolderData[]>('/folders', get)

// Fetch single document
const { data: doc } = useSWR<DocumentData>(`/documents/${id}`, get)
```

## Update Operations

### Renaming a Document

Document updates use optimistic updates with SWR for both list and individual document views:

```typescript
const renameDocument = async (id: string, title: string) => {
  // Optimistic update for list view
  const updatedDocs = docs.map(doc => 
    doc._id === id ? { ...doc, title } : doc
  )
  mutateDocs(updatedDocs, false)

  try {
    // Update the document
    const updatedDoc = await operations.patchDocument(id, {
      title,
      lastUpdated: Date.now(),
    })

    // Update both caches
    await Promise.all([
      mutateDocs(current => 
        current?.map(doc => doc._id === id ? { ...doc, title } : doc)
      ),
      mutate(`/documents/${id}`, { ...updatedDoc, title }, false)
    ])
  } catch (e) {
    mutateDocs() // Revert on error
  }
}
```

### Moving Items

Moving items (documents or folders) uses the `moveItem` operation:

```typescript
const handleMoveItem = async (
  itemId: string, 
  targetFolderId?: string, 
  targetIndex?: number
) => {
  try {
    await moveItem(
      itemId,
      targetFolderId,
      targetIndex,
      docs,
      folders,
      operations,
      (updatedDocs, updatedFolders) => {
        mutateDocs(updatedDocs, false)
        mutateFolders(updatedFolders, false)
      }
    )
  } catch (error) {
    mutateDocs()
    mutateFolders()
  }
}
```

## Delete Operations

### Single Document/Folder Delete

Single items are deleted through the API service:

```typescript
// In api-service.ts
const deleteDocument = async (id: string) => {
  const result = await makeRequest('delete', `/documents/${id}`)
  return result.data
}
```

### Bulk Delete

Bulk deletion handles both documents and folders, including recursive folder deletion:

```typescript
const handleBulkDelete = async (documentIds: string[], folderIds: string[]) => {
  try {
    await bulkDelete(
      documentIds,
      folderIds,
      docs,
      folders,
      operations,
      (updatedDocs, updatedFolders) => {
        mutateDocs(updatedDocs, false)
        mutateFolders(updatedFolders, false)
      }
    )
  } catch (error) {
    mutateDocs()
    mutateFolders()
  }
}
```

## Backend Implementation

### Web Backend (Next.js API)

The web backend uses MongoDB through a storage adapter:

```typescript
// In pages/api/documents/[id].ts
export default withHybridAuth(async function handler(req: ExtendedApiRequest, res: NextApiResponse) {
  const { method, query: { id }, user } = req

  if (!user) {
    res.status(401).end('Unauthorized')
    return
  }

  switch (method) {
    case 'GET':
      const doc = await storage.findById('documents', id as string)
      res.status(200).json(doc)
      break
    case 'PATCH':
      const updated = await storage.update('documents', id as string, req.body)
      res.status(200).json(updated)
      break
    case 'DELETE':
      await storage.delete('documents', { _id: id })
      res.status(200).json({ success: true })
      break
    default:
      res.setHeader('Allow', ['GET', 'PATCH', 'DELETE'])
      res.status(405).end(`Method ${method} Not Allowed`)
  }
})
```

### Electron Backend

The Electron backend uses a file-based storage system:

```typescript
// In electron/api-service.ts
const makeRequest = async (method, endpoint, data) => {
  if (useLocalDb) {
    // Handle document operations
    if (endpoint.startsWith('documents/')) {
      const id = endpoint.split('documents/')[1]
      switch (method) {
        case 'get':
          return { data: await documentStorage.findById(DOCUMENTS_COLLECTION, id) }
        case 'patch':
          return { data: await documentStorage.update(DOCUMENTS_COLLECTION, id, data) }
        case 'delete':
          return { data: await documentStorage.delete(DOCUMENTS_COLLECTION, { _id: id }) }
      }
    }
  }
  // Fall back to remote API
  return axios[method](url, data, config)
}
```

## Best Practices

1. Always use optimistic updates for better UX
2. Handle errors by reverting optimistic updates
3. Update all relevant caches when modifying data
4. Use the shared operations interface for consistency
5. Implement proper error handling and loading states

## Common Pitfalls

1. Forgetting to update individual document cache when renaming
2. Not handling undefined states in data fetching
3. Missing error handling in optimistic updates
4. Not maintaining folder structure in move operations
5. Forgetting to revalidate caches after operations
