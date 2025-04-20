'use client'
import '@styles/globals.css'
import '@styles/hamburgers/hamburgers.scss'
import '@styles/loading-indicator.css'
import { DocumentData } from '@typez/globals'

import { UserProvider } from '@wrappers/auth-wrapper-client'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import useSWR from 'swr'

// Entity Context types
export type EntityType = 'document' | 'conversation' | 'scene'

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

export type AnyEntity = DocumentEntity | ConversationEntity | SceneEntity

interface EntityContextType {
  entities: {
    documents: DocumentEntity[]
    conversations: ConversationEntity[]
    scenes: SceneEntity[]
  }
  isLoading: boolean
  refreshEntities: () => Promise<void>
  filterEntities: (type: EntityType, searchTerm?: string) => AnyEntity[]
  getEntityById: (type: EntityType, id: string) => AnyEntity | undefined
  loadDocumentContent: (documentId: string) => Promise<DocumentEntity | undefined>
  loadConversationContent: (conversationId: string) => Promise<ConversationEntity | undefined>
}

const entityContextDefaultValue: EntityContextType = {
  entities: {
    documents: [],
    conversations: [],
    scenes: [],
  },
  isLoading: false,
  refreshEntities: async () => {},
  filterEntities: () => [],
  getEntityById: () => undefined,
  loadDocumentContent: async () => undefined,
  loadConversationContent: async () => undefined,
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
  } = useSWR('/documents', fetcher, {
    revalidateOnFocus: false,
    focusThrottleInterval: 30000,
    dedupingInterval: 10000,
    revalidateIfStale: false,
  })

  // State for processed entities
  const [documentEntities, setDocumentEntities] = useState<DocumentEntity[]>([])
  const [conversationEntities, setConversationEntities] = useState<ConversationEntity[]>([])
  const [sceneEntities, setSceneEntities] = useState<SceneEntity[]>([])

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
        console.error(`Error processing document ${document._id} for conversations:`, error)
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
    console.log(`Extracting conversations from document: ${documentId} (${documentTitle})`)
    const conversationsMap: Record<string, any> = {}

    let parsedContent = documentContent
    if (typeof documentContent === 'string') {
      try {
        parsedContent = JSON.parse(documentContent)
        console.log(`Successfully parsed document content from string`)
      } catch (e) {
        console.error(`Failed to parse content for doc ${documentId} in extractAllConversations:`, e)
        return []
      }
    }

    if (!parsedContent || parsedContent.type !== 'doc') {
      console.warn(`Invalid content structure for doc ${documentId} in extractAllConversations`)
      console.log(`Document content type:`, parsedContent ? parsedContent.type : 'undefined')
      return []
    }

    console.log(`Processing document content to extract conversations`)

    // Count of dialogue marks found
    let dialogueMarkCount = 0

    const processNode = (node: any) => {
      if (node.type === 'text' && node.marks) {
        node.marks.forEach((mark: any) => {
          if (mark.type === 'dialogue' && mark.attrs?.conversationId && mark.attrs?.character && node.text) {
            dialogueMarkCount++
            const { conversationId } = mark.attrs
            const conversationName = mark.attrs?.conversationName || null

            console.log(
              `Found dialogue mark with conversation ID: ${conversationId}, character: ${mark.attrs.character}`,
            )

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
    console.log(`Extracted ${conversations.length} conversations, found ${dialogueMarkCount} dialogue marks`)

    // Log the conversations found
    conversations.forEach(conv => {
      console.log(
        `Conversation: ${conv.conversationId}, Name: ${conv.conversationName || 'Unnamed'}, Entries: ${conv.entries.length}`,
      )
    })

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
    }))
    setDocumentEntities(docEntities)

    // Process conversation entities
    const convEntities = extractConversationsFromDocuments(documents)
    setConversationEntities(convEntities)

    // TODO: Process scene entities once scene detection is implemented
    setSceneEntities([])
  }, [documents])

  // Listen for sync updates (for Electron)
  useEffect(() => {
    if (!isElectron) return // Skip this effect in web version

    const removeListener = window.electronAPI.onSyncUpdate((updates: any) => {
      if (updates.documents && updates.documents.length > 0) {
        mutateDocuments()
      }
    })

    return () => {
      removeListener()
    }
  }, [isElectron, mutateDocuments])

  // Function to manually refresh entities
  const refreshEntities = async () => {
    setIsRefreshing(true)
    try {
      await mutateDocuments()
    } catch (error) {
      console.error('Error refreshing entities:', error)
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
      default:
        return undefined
    }
  }

  // Function to load document content for a specific document
  const loadDocumentContent = async (documentId: string): Promise<DocumentEntity | undefined> => {
    try {
      console.log(`Loading document content for ID: ${documentId}`)
      // Find the document entity
      const docEntity = documentEntities.find(doc => doc.id === documentId)
      if (!docEntity) {
        console.log(`Document entity not found for ID: ${documentId}`)
        return undefined
      }

      // If the document already has content, return it
      if (docEntity.content && Object.keys(docEntity.content).length > 0) {
        console.log(`Document content already loaded for ID: ${documentId}`)
        return docEntity
      }

      // Fetch the document with content
      const documentWithContent = await fetcher(`/documents/${documentId}`)
      console.log(
        `Fetched document content for ID: ${documentId}:`,
        documentWithContent?.content ? 'success' : 'failed',
      )

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
      console.error(`Error loading document content for ID: ${documentId}:`, error)
      return undefined
    }
  }

  // Function to load conversation content including dialogue entries
  const loadConversationContent = async (conversationId: string): Promise<ConversationEntity | undefined> => {
    try {
      console.log(`Loading conversation content for ID: ${conversationId}`)
      // Find the conversation entity
      const convEntity = conversationEntities.find(conv => conv.id === conversationId)
      if (!convEntity) {
        console.log(`Conversation entity not found for ID: ${conversationId}`)
        return undefined
      }

      // If the conversation already has fully populated entries, return it
      if (convEntity.entries && convEntity.entries.length > 0) {
        console.log(`Conversation content already loaded for ID: ${conversationId}`)
        return convEntity
      }

      // For conversations, we need to get the parent document first
      if (!convEntity.parentId) {
        console.log(`No parentId found for conversation: ${conversationId}`)
        return convEntity
      }

      // Get the parent document with content
      const documentEntity = await loadDocumentContent(convEntity.parentId)
      if (!documentEntity || !documentEntity.content) {
        console.log(`Failed to load parent document content for conversation: ${conversationId}`)
        return convEntity
      }

      // Use the conversation's actual ID field rather than trying to parse it from the entity ID
      const actualConversationId = convEntity.conversationId
      console.log(`Extracting conversation ${actualConversationId} from document`)

      // Extract conversations from document
      const conversations = extractAllConversations(
        documentEntity.content,
        documentEntity.name,
        documentEntity.id,
      )

      // Find the specific conversation
      const conversationData = conversations.find(c => c.conversationId === actualConversationId)
      if (!conversationData) {
        console.log(`Conversation ${actualConversationId} not found in document content`)

        // Debug: Log all conversation IDs found in the document
        console.log(
          `Found conversation IDs in document:`,
          conversations.map(c => c.conversationId).join(', '),
        )

        return convEntity
      }

      console.log(`Found conversation with ${conversationData.entries?.length || 0} entries`)

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
      console.error(`Error loading conversation content for ID: ${conversationId}:`, error)
      return undefined
    }
  }

  // Context value
  const value: EntityContextType = {
    entities: {
      documents: documentEntities,
      conversations: conversationEntities,
      scenes: sceneEntities,
    },
    isLoading: documentsLoading || isRefreshing,
    refreshEntities,
    filterEntities,
    getEntityById,
    loadDocumentContent,
    loadConversationContent,
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
      console.error('Error clearing tree state:', e)
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
