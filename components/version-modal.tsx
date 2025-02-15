'use client'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableRow from '@mui/material/TableRow'
import InsertDriveFileTwoToneIcon from '@mui/icons-material/InsertDriveFileTwoTone'
import { DocumentData, VersionData } from '@typez/globals'
import { useUser } from '@wrappers/auth-wrapper-client'
import { useCallback, useEffect, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import Editor from './editor'
import { useAPI } from './providers'

interface VersionModalProps {
  open: boolean
  onClose: () => void
  document: DocumentData & { id: string }
}

const VersionModal = ({ open, onClose, document }: VersionModalProps) => {
  const { user } = useUser()
  const api = useAPI()
  const fetcher = useCallback(
    async (path: string) => {
      return await api.get(path)
    },
    [api],
  )

  const { data, isLoading, mutate: mutateVersions } = useSWR<VersionData[], Error>(
    `/documents/${document._id}/versions`,
    fetcher,
  )
  const [versions, setVersions] = useState<VersionData[]>([])
  const [selectedVersion, setSelectedVersion] = useState<VersionData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    if (!data) return
    setVersions(data)
  }, [data, isLoading])

  const handleCreateVersion = async () => {
    try {
      const newVersion: Omit<VersionData, 'id'> = {
        documentId: document._id,
        content: document.content,
        createdAt: Date.now(),
        name: ''
      }
      await api.post(`/documents/${document._id}/versions`, newVersion)
      mutateVersions()
    } catch (e) {
      console.error('Error creating version:', e)
    }
  }

  const handleRestoreVersion = async () => {
    if (!selectedVersion || !document?._id) {
      console.error('Missing required data:', { selectedVersion, documentId: document?._id })
      return
    }

    try {

      // Update the document with the version's content
      await api.patch(`/documents/${document._id}`, {
        content: selectedVersion.content,
        lastUpdated: Date.now()
      })
      
      // Update both the document cache and the hybrid document state
      const updatedDoc = {
        ...document,
        content: selectedVersion.content,
        lastUpdated: Date.now()
      }

      // Store in session storage for hybrid state
      if (process.env.NEXT_PUBLIC_STORAGE_TYPE !== 'json') {
        sessionStorage.setItem(document._id, JSON.stringify(updatedDoc))
      }
      
      // Force revalidation of both the document data and hybrid state
      await Promise.all([
        globalMutate(`/documents/${document._id}`, updatedDoc, true),
        globalMutate(`/hybrid-documents/${document._id}`, updatedDoc, true)
      ])
      
      onClose()
    } catch (e) {
      console.error('Error in restore process:', e)
    }
  }

  const handleOpen = () => setPreviewOpen(true)
  const handleClose = () => setPreviewOpen(false)

  if (!user || isLoading) return <></>

  versions.sort((versionA, versionB) => versionB.createdAt - versionA.createdAt)

  return (
    <Dialog open={open} onClose={onClose}>
      <Box sx={{ minWidth: '576px' }} onClick={() => setSelectedVersion(null)}>
        <DialogTitle>Versions</DialogTitle>
        <DialogContent>
          <DialogContentText>Preview or restore to a previous version of this document.</DialogContentText>
          <Box sx={{ padding: '16px' }}>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  {versions.map(version => (
                    <TableRow
                      hover
                      key={version.id}
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedVersion(version)
                      }}
                      selected={version === selectedVersion}>
                      <TableCell component="th" scope="row">
                        <InsertDriveFileTwoToneIcon fontSize="medium" />
                      </TableCell>
                      <TableCell component="th" scope="row">
                        {new Date(version.createdAt).toDateString()}
                      </TableCell>
                      <TableCell sx={{ maxWidth: '160px' }}>{version.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          {selectedVersion && (
            <>
              <Button onClick={handleOpen}>Preview</Button>
              <Button onClick={handleRestoreVersion}>Restore</Button>
            </>
          )}
          {!selectedVersion && <Button onClick={handleCreateVersion}>Create Version</Button>}
          <Button onClick={onClose}>Done</Button>
        </DialogActions>
      </Box>
      {selectedVersion && (
        <Dialog fullScreen open={previewOpen} onClose={handleClose}>
          <div className="flex h-[calc(100vh)] justify-center overflow-y-scroll p-[20px] pb-10 font-editor2 text-black/[.79]">
            <div className="relative flex min-w-[calc(100vw_-_40px)] max-w-[740px] pb-10 md:min-w-[0px]">
              <Editor
                content={selectedVersion.content}
                title={document.title}
                onUpdate={() => {}} // Preview is read-only
                canEdit={false}
                hideFooter={true}
              />
            </div>
          </div>
          <DialogActions>
            <Button onClick={handleClose}>Close</Button>
          </DialogActions>
        </Dialog>
      )}
    </Dialog>
  )
}

export default VersionModal
