'use client'
import '@styles/globals.css'
import '@styles/hamburgers/hamburgers.scss'
import '@styles/loading-indicator.css'
import { DocumentData } from '@typez/globals'

import { UserProvider } from '@wrappers/auth-wrapper-client'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import useSWR from 'swr'

// Entity Context types
export type EntityType = 'document' | 'conversation' | 'scene' | 'folder'

export interface Entity {
  id: string
  type: EntityType
  name: string
  parentId?: string
  parentType?: EntityType
  lastUpdated?: number
}

interface DocumentEntity extends Entity {
  type: 'document'
  content?: any // Document content, only loaded when needed
}

interface ConversationEntity extends Entity {
  type: 'conversation'
  parentId: string
  parentType: 'document'
  conversationId: string // Original conversation ID in the document
  entries?: any[] // Dialogue entries
  conversationName?: string
  documentTitle?: string
}

interface SceneEntity extends Entity {
  type: 'scene'
  parentId: string
  parentType: 'document'
  sceneId: string // Original scene ID in the document
}

interface FolderEntity extends Entity {
  type: 'folder'
  parentId?: string | 'root'
  folderIndex?: number
}

export type AnyEntity = DocumentEntity | ConversationEntity | SceneEntity | FolderEntity

interface EntityContextType {
  entities: {
    documents: DocumentEntity[]
    conversations: ConversationEntity[]
    scenes: SceneEntity[]
    folders: FolderEntity[]
  }
  isLoading: boolean
  refreshEntities: () => Promise<void>
  filterEntities: (type: EntityType, searchTerm?: string) => AnyEntity[]
  getEntityById: (type: EntityType, id: string) => AnyEntity | undefined
  loadDocumentContent: (documentId: string) => Promise<DocumentEntity | undefined>
  loadConversationContent: (conversationId: string) => Promise<ConversationEntity | undefined>
  loadFolderContent: (folderId: string) => Promise<DocumentEntity[]>
}

const entityContextDefaultValue: EntityContextType = {
  entities: {
    documents: [],
    conversations: [],
    scenes: [],
    folders: [],
  },
  isLoading: false,
  refreshEntities: async () => {},
  filterEntities: () => [],
  getEntityById: () => undefined,
  loadDocumentContent: async () => undefined,
  loadConversationContent: async () => undefined,
  loadFolderContent: async () => [],
}

const EntityContext = createContext<EntityContextType>(entityContextDefaultValue)

export function useEntities() {
  return useContext(EntityContext)
}

// ----------------- Existing Mouse Context -----------------

type mouseContextType = {
  hoveringOverMenu: boolean
  mouseMoved: boolean
  onMouseMove: (clientY: number) => void
}

const mouseContextDefaultValue: mouseContextType = {
  hoveringOverMenu: false,
  mouseMoved: false,
  onMouseMove: () => {},
}

const MouseContext = createContext<mouseContextType>(mouseContextDefaultValue)

type navContextType = {
  navigateTo: (path: string) => void
  getLocation: () => string
  signOut: () => void
  clearTreeState: () => void
}

const navContextDefaultValue: navContextType = {
  navigateTo: () => {},
  getLocation: () => '',
  signOut: () => {},
  clearTreeState: () => {},
}

const NavigationContext = createContext<navContextType>(navContextDefaultValue)

export type ApiResponse<T = any> = Promise<T>

type apiContextType = {
  post: (path: string, body: any) => ApiResponse
  patch: (path: string, body: any) => ApiResponse
  destroy: (path: string) => void
  get: (path: string) => ApiResponse
  delete: (path: string) => ApiResponse
}

const apiContextDefaultValue: apiContextType = {
  post: async () => ({ data: {} }),
  patch: async () => ({ data: {} }),
  destroy: async () => {},
  get: async () => ({ data: {} }),
  delete: async () => ({ data: {} }),
}

const APIContext = createContext<apiContextType>(apiContextDefaultValue)

export function useAPI() {
  return useContext(APIContext)
}

type DocumentContextType = {
  getDocument: (id: string) => Promise<DocumentData>
}

const documentContextDefaultValue: DocumentContextType = {
  getDocument: async () => ({}) as DocumentData,
}

const DocumentContext = createContext<DocumentContextType>(documentContextDefaultValue)

export function useDocument() {
  return useContext(DocumentContext)
}

export function useNavigation() {
  return useContext(NavigationContext)
}

export function useMouse() {
  return useContext(MouseContext)
}

const useDebouncedEffect = (effect: () => void, deps: any[], delay: number) => {
  useEffect(() => {
    const handler = setTimeout(() => effect(), delay)
    return () => clearTimeout(handler)
  }, [deps, delay, effect])
}

// ----------------- Entity Provider -----------------

export function EntityProvider({ children }: { children: ReactNode }) {
  const { get } = useAPI()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Check if we're in Electron environment
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  // Use the appropriate fetch function based on environment
  const fetcher = isElectron ? window.electronAPI.get : get

  // Fetch documents using SWR
  const {
    data: documents,
    mutate: mutateDocuments,
    isLoading: documentsLoading,
  } = useSWR('/documents?metadataOnly=true', fetcher, {
    // we probably do want all the documents here, but they shouldn't slow things down
    revalidateOnFocus: false,
    focusThrottleInterval: 30000,
    dedupingInterval: 10000,
    revalidateIfStale: false,
  })

  // Fetch folders using SWR
  const {
    data: folders,
    mutate: mutateFolders,
    isLoading: foldersLoading,
  } = useSWR('/folders', fetcher, {
    revalidateOnFocus: false,
    focusThrottleInterval: 30000,
    dedupingInterval: 10000,
    revalidateIfStale: false,
  })

  // State for processed entities
  const [documentEntities, setDocumentEntities] = useState<DocumentEntity[]>([])
  const [conversationEntities, setConversationEntities] = useState<ConversationEntity[]>([])
  const [sceneEntities, setSceneEntities] = useState<SceneEntity[]>([])
  const [folderEntities, setFolderEntities] = useState<FolderEntity[]>([])

  // Extract conversations from documents (similar to extractAllConversations in conversations-page.tsx)
  const extractConversationsFromDocuments = (docs: any[]) => {
    if (!docs || docs.length === 0) return []

    const extractedConversations: ConversationEntity[] = []

    for (const document of docs) {
      if (!document || !document._id) continue

      try {
        // Extract conversations from document content
        const conversationsFromDoc = extractAllConversations(
          document.content,
          document.title || 'Untitled Document',
          document._id,
          document.lastUpdated,
        )

        // Convert to entity format
        conversationsFromDoc.forEach(conv => {
          extractedConversations.push({
            id: `${document._id}-conversation-${conv.conversationId}`,
            type: 'conversation',
            name: conv.conversationName || `Unnamed Conversation (${conv.conversationId})`,
            parentId: document._id,
            parentType: 'document',
            lastUpdated: conv.lastUpdated,
            conversationId: conv.conversationId,
            entries: conv.entries,
            conversationName: conv.conversationName,
            documentTitle: conv.documentTitle,
          })
        })
      } catch (error) {
        // Error handling without console.error
      }
    }

    return extractedConversations
  }

  // Helper function to extract all conversations from a document
  const extractAllConversations = (
    documentContent: any,
    documentTitle: string,
    documentId: string,
    lastUpdated?: number,
  ): any[] => {
    const conversationsMap: Record<string, any> = {}

    let parsedContent = documentContent
    if (typeof documentContent === 'string') {
      try {
        parsedContent = JSON.parse(documentContent)
      } catch (e) {
        return []
      }
    }

    if (!parsedContent || parsedContent.type !== 'doc') {
      return []
    }

    const processNode = (node: any) => {
      if (node.type === 'text' && node.marks) {
        node.marks.forEach((mark: any) => {
          if (mark.type === 'dialogue' && mark.attrs?.conversationId && mark.attrs?.character && node.text) {
            const { conversationId } = mark.attrs
            const conversationName = mark.attrs?.conversationName || null

            if (!conversationsMap[conversationId]) {
              conversationsMap[conversationId] = {
                conversationId,
                conversationName,
                documentId,
                documentTitle,
                entries: [],
                lastUpdated: lastUpdated || Date.now(),
              }
            }

            // Add dialogue entry
            conversationsMap[conversationId].entries.push({
              character: mark.attrs.character,
              text: node.text,
            })

            if (conversationName && conversationsMap[conversationId].conversationName !== conversationName) {
              if (conversationsMap[conversationId].conversationName === null) {
                conversationsMap[conversationId].conversationName = conversationName
              }
            }
          }
        })
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(processNode)
      }
    }

    processNode(parsedContent)

    const conversations = Object.values(conversationsMap)

    return conversations
  }

  // Process documents into entities whenever they change
  useEffect(() => {
    if (!documents) return

    // Process document entities
    const docEntities: DocumentEntity[] = documents.map((doc: any) => ({
      id: doc._id,
      type: 'document',
      name: doc.title || 'Untitled Document',
      lastUpdated: doc.lastUpdated,
      parentId: doc.parentId,
      parentType: doc.parentId && doc.parentId !== 'root' ? 'folder' : undefined,
    }))
    setDocumentEntities(docEntities)

    // Process conversation entities
    const convEntities = extractConversationsFromDocuments(documents)
    setConversationEntities(convEntities)

    // TODO: Process scene entities once scene detection is implemented
    setSceneEntities([])
  }, [documents])

  // Process folders into entities whenever they change
  useEffect(() => {
    if (!folders) return

    // Process folder entities
    const folderEnts: FolderEntity[] = folders.map((folder: any) => ({
      id: folder._id,
      type: 'folder',
      name: folder.title || 'Untitled Folder',
      lastUpdated: folder.lastUpdated,
      parentId: folder.parentId,
      parentType: folder.parentId && folder.parentId !== 'root' ? 'folder' : undefined,
      folderIndex: folder.folderIndex,
    }))
    setFolderEntities(folderEnts)
  }, [folders])

  // Listen for sync updates (for Electron)
  useEffect(() => {
    if (!isElectron) return // Skip this effect in web version

    const removeListener = window.electronAPI.onSyncUpdate((updates: any) => {
      if (updates.documents && updates.documents.length > 0) {
        // console.log('sync:updates documents', updates.documents)
        mutateDocuments()
      }
      if (updates.folders && updates.folders.length > 0) {
        // console.log('sync:updates folders', updates.folders)
        mutateFolders()
      }
    })

    return () => {
      removeListener()
    }
  }, [isElectron, mutateDocuments, mutateFolders])

  // Function to manually refresh entities
  const refreshEntities = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([mutateDocuments(), mutateFolders()])
    } catch (error) {
      // Error handling without console.error
    } finally {
      setIsRefreshing(false)
    }
  }

  // Function to filter entities by type and search term
  const filterEntities = (type: EntityType, searchTerm?: string): AnyEntity[] => {
    let entities: AnyEntity[] = []

    switch (type) {
      case 'document':
        entities = [...documentEntities]
        break
      case 'conversation':
        entities = [...conversationEntities]
        break
      case 'scene':
        entities = [...sceneEntities]
        break
      case 'folder':
        entities = [...folderEntities]
        break
    }

    if (!searchTerm) return entities

    // Filter by name (case-insensitive)
    const lowerSearchTerm = searchTerm.toLowerCase()
    return entities.filter(entity => entity.name.toLowerCase().includes(lowerSearchTerm))
  }

  // Function to get entity by ID
  const getEntityById = (type: EntityType, id: string): AnyEntity | undefined => {
    switch (type) {
      case 'document':
        return documentEntities.find(entity => entity.id === id)
      case 'conversation':
        return conversationEntities.find(entity => entity.id === id)
      case 'scene':
        return sceneEntities.find(entity => entity.id === id)
      case 'folder':
        return folderEntities.find(entity => entity.id === id)
      default:
        return undefined
    }
  }

  // Function to load document content for a specific document
  const loadDocumentContent = async (documentId: string): Promise<DocumentEntity | undefined> => {
    try {
      // Find the document entity
      const docEntity = documentEntities.find(doc => doc.id === documentId)
      if (!docEntity) {
        return undefined
      }

      // If the document already has content, return it
      if (docEntity.content && Object.keys(docEntity.content).length > 0) {
        return docEntity
      }

      // Fetch the document with content
      const documentWithContent = await fetcher(`/documents/${documentId}`)

      if (documentWithContent && documentWithContent.content) {
        // Update the document entity with content
        const updatedEntity = {
          ...docEntity,
          content: documentWithContent.content,
        }

        // Update the document entities state
        setDocumentEntities(prev => prev.map(doc => (doc.id === documentId ? updatedEntity : doc)))

        return updatedEntity
      }

      return docEntity
    } catch (error) {
      return undefined
    }
  }

  // Function to load conversation content including dialogue entries
  const loadConversationContent = async (conversationId: string): Promise<ConversationEntity | undefined> => {
    try {
      // Find the conversation entity
      const convEntity = conversationEntities.find(conv => conv.id === conversationId)
      if (!convEntity) {
        return undefined
      }

      // If the conversation already has fully populated entries, return it
      if (convEntity.entries && convEntity.entries.length > 0) {
        return convEntity
      }

      // For conversations, we need to get the parent document first
      if (!convEntity.parentId) {
        return convEntity
      }

      // Get the parent document with content
      const documentEntity = await loadDocumentContent(convEntity.parentId)
      if (!documentEntity || !documentEntity.content) {
        return convEntity
      }

      // Use the conversation's actual ID field rather than trying to parse it from the entity ID
      const actualConversationId = convEntity.conversationId

      // Extract conversations from document
      const conversations = extractAllConversations(
        documentEntity.content,
        documentEntity.name,
        documentEntity.id,
      )

      // Find the specific conversation
      const conversationData = conversations.find(c => c.conversationId === actualConversationId)
      if (!conversationData) {
        return convEntity
      }

      // Update the conversation entity with entries and other data
      const updatedEntity: ConversationEntity = {
        ...convEntity,
        entries: conversationData.entries || [],
        conversationName: conversationData.conversationName || convEntity.name,
        documentTitle: documentEntity.name,
      }

      // Update the conversation entities state
      setConversationEntities(prev => prev.map(conv => (conv.id === conversationId ? updatedEntity : conv)))

      return updatedEntity
    } catch (error) {
      return undefined
    }
  }

  // Function to load all documents that are immediate children of a folder
  const loadFolderContent = async (folderId: string): Promise<DocumentEntity[]> => {
    try {
      // Find the folder entity
      const folderEntity = folderEntities.find(folder => folder.id === folderId)
      if (!folderEntity) {
        return []
      }

      // Filter documents that have this folder as their parentId
      const docsInFolder = documentEntities.filter(doc => doc.parentId === folderId)

      // If we need the content of these documents, we can load them
      const documentsWithContent: DocumentEntity[] = []
      for (const doc of docsInFolder) {
        const docWithContent = await loadDocumentContent(doc.id)
        if (docWithContent) {
          documentsWithContent.push(docWithContent)
        }
      }

      return documentsWithContent
    } catch (error) {
      return []
    }
  }

  // Context value
  const value: EntityContextType = {
    entities: {
      documents: documentEntities,
      conversations: conversationEntities,
      scenes: sceneEntities,
      folders: folderEntities,
    },
    isLoading: documentsLoading || foldersLoading || isRefreshing,
    refreshEntities,
    filterEntities,
    getEntityById,
    loadDocumentContent,
    loadConversationContent,
    loadFolderContent,
  }

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>
}

export function DocumentProvider({
  children,
  getDocument,
}: DocumentContextType & {
  children: React.ReactNode
}) {
  const value = { getDocument }

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>
}

export function APIProvider({
  children,
  post,
  patch,
  destroy,
  get,
  delete: deleteMethod,
}: apiContextType & {
  children: React.ReactNode
}) {
  const value = { post, patch, destroy, get, delete: deleteMethod }
  return <APIContext.Provider value={value}>{children}</APIContext.Provider>
}

export function NavigationProvider({
  children,
  navigateTo,
  getLocation,
  signOut,
}: {
  children: ReactNode
  navigateTo: (path: string) => void
  getLocation: () => string
  signOut: () => void
}) {
  const clearTreeState = () => {
    try {
      localStorage.removeItem('editor-tree-expanded')
    } catch (e) {
      // Error handling without console.error
    }
  }

  const value = {
    navigateTo: (path: string) => {
      // Clear tree state when navigating to documents list
      if (path === '/documents') {
        clearTreeState()
      }
      navigateTo(path)
    },
    getLocation,
    signOut,
    clearTreeState,
  }

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
}

export function MouseProvider({ children }: { children: ReactNode }) {
  const [mouseMoved, setMouseMoved] = useState(false)
  const [hoveringOverMenu, setHoveringOverMenu] = useState(false)

  useDebouncedEffect(
    () => {
      setMouseMoved(false)
    },
    [mouseMoved],
    5000,
  )

  const onMouseMove = (clientY: number) => {
    setMouseMoved(true)
    if (clientY < 45 && !hoveringOverMenu) {
      setHoveringOverMenu(true)
    }
    if (clientY >= 45 && hoveringOverMenu) {
      setHoveringOverMenu(false)
    }
  }

  const value = {
    mouseMoved,
    onMouseMove,
    hoveringOverMenu,
  }

  return (
    <>
      <MouseContext.Provider value={value}>{children}</MouseContext.Provider>
    </>
  )
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <MouseProvider>
      <EntityProvider>
        <UserProvider>{children}</UserProvider>
      </EntityProvider>
    </MouseProvider>
  )
}

export default Providers
