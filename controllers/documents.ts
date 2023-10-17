import { createDocument, createPermission, getDocuments } from "../lib/mongo-utils"
import { DocumentData } from '../types/globals'

export async function createNewDocument(body: any, userSub: string) {
  const newDocument = await createDocument(body)
  await createPermission({ ownerId: userSub, documentId: newDocument.id })
  return newDocument
}

export async function fetchUserDocuments(userSub: string) {
  const documents = await getDocuments(userSub)
  const docsWithPermissions = documents.map(doc => {
    doc.canEdit = true
    doc.canComment = true
    return doc
  })
  return docsWithPermissions as DocumentData[]
}
