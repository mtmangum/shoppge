'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, Trash2, Upload } from 'lucide-react'

interface Attachment {
  id: number
  originalName: string
  fileSizeBytes: number | null
  mimeType: string | null
  uploadedAt: string
  uploadedByName?: string
}

interface AttachmentsPanelProps {
  jobId: number
  attachments: Attachment[]
  canDelete: boolean
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentsPanel({ jobId, attachments, canDelete }: AttachmentsPanelProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/jobs/${jobId}/attachments`, { method: 'POST', body: form })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(error ?? 'Upload failed')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(attachmentId: number) {
    setDeletingId(attachmentId)
    try {
      const res = await fetch(`/api/jobs/${jobId}/attachments/${attachmentId}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Delete failed' }))
        throw new Error(error ?? 'Delete failed')
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {attachments.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No attachments yet.</p>
      ) : (
        <ul className="divide-y">
          {attachments.map(att => (
            <li key={att.id} className="flex items-center justify-between py-2 text-sm">
              <a
                href={`/api/jobs/${jobId}/attachments/${att.id}`}
                className="flex items-center gap-2 text-[#BF5700] hover:underline"
              >
                <Paperclip className="h-4 w-4 shrink-0" />
                {att.originalName}
              </a>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{formatBytes(att.fileSizeBytes)}</span>
                {att.uploadedByName && <span>{att.uploadedByName}</span>}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(att.id)}
                    disabled={deletingId === att.id}
                    className="text-gray-400 hover:text-red-500 disabled:opacity-50"
                    aria-label={`Delete ${att.originalName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleUpload} className="flex items-center gap-2 pt-2 border-t">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          aria-label="Choose attachment file"
          className="text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:text-sm file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={uploading}
          className="flex items-center gap-1 bg-[#BF5700] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </form>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <p className="text-xs text-gray-500">PDF, PNG, or JPEG. Max 25MB.</p>
    </div>
  )
}
