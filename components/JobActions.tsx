'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { JobStatus } from '@/lib/types'

interface JobActionsProps {
  jobId: number
  status: JobStatus
  machinistId: number | null | undefined
  currentUserId: number
  materialsRequired: boolean
  materialsOrdered: boolean
  machinistNotes: string
  machinists: Array<{ id: number; name: string }>
  isAdmin: boolean
}

const STATUS_OPTIONS: JobStatus[] = ['pending', 'inprogress', 'completed', 'cancelled']

export function JobActions({
  jobId,
  status,
  machinistId,
  currentUserId,
  materialsRequired,
  materialsOrdered,
  machinistNotes,
  machinists,
  isAdmin,
}: JobActionsProps) {
  const router = useRouter()

  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [statusValue, setStatusValue] = useState<JobStatus>(status)
  const [statusNote, setStatusNote] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [assigneeValue, setAssigneeValue] = useState<string>(machinistId ? String(machinistId) : '')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)

  const [materialsReq, setMaterialsReq] = useState(materialsRequired)
  const [materialsOrd, setMaterialsOrd] = useState(materialsOrdered)
  const [materialsSaving, setMaterialsSaving] = useState(false)

  const [notes, setNotes] = useState(machinistNotes)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [notesSaved, setNotesSaved] = useState(false)

  async function patchJob(body: Record<string, unknown>) {
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error ?? 'Request failed')
    }
  }

  async function handleStatusSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatusSaving(true)
    setStatusError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue, note: statusNote || undefined }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error ?? 'Request failed')
      }
      setStatusNote('')
      router.refresh()
    } catch (e: any) {
      setStatusError(e.message)
    } finally {
      setStatusSaving(false)
    }
  }

  async function handleAssign(nextValue: string) {
    setAssigneeValue(nextValue)
    setAssignSaving(true)
    setAssignError(null)
    try {
      await patchJob({ machinistId: nextValue ? parseInt(nextValue) : null })
      router.refresh()
    } catch (e: any) {
      setAssignError(e.message)
    } finally {
      setAssignSaving(false)
    }
  }

  async function handleMaterialsChange(field: 'materialsRequired' | 'materialsOrdered', value: boolean) {
    if (field === 'materialsRequired') setMaterialsReq(value)
    else setMaterialsOrd(value)
    setMaterialsSaving(true)
    try {
      await patchJob({ [field]: value })
      router.refresh()
    } finally {
      setMaterialsSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete job #${jobId} permanently? This removes its items, attachments, and status history. This cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Delete failed' }))
        throw new Error(error ?? 'Delete failed')
      }
      router.push('/jobs')
      router.refresh()
    } catch (e: any) {
      setDeleteError(e.message)
      setDeleting(false)
    }
  }

  async function handleNotesSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNotesSaving(true)
    setNotesError(null)
    setNotesSaved(false)
    try {
      await patchJob({ machinistNotes: notes })
      setNotesSaved(true)
      router.refresh()
    } catch (e: any) {
      setNotesError(e.message)
    } finally {
      setNotesSaving(false)
    }
  }

  return (
    <section className="bg-white rounded-lg border p-6 space-y-6 text-sm">
      <h3 className="font-semibold text-gray-700 border-b pb-2">Machinist Actions</h3>

      {/* Assignment */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-gray-500">Assigned Machinist</label>
        <div className="flex gap-2">
          <div className="relative w-full">
            <select
              value={assigneeValue}
              onChange={e => handleAssign(e.target.value)}
              disabled={assignSaving}
              className="border rounded-md px-2 py-1.5 text-sm w-full appearance-none pr-8 disabled:opacity-50"
            >
              <option value="">Unassigned</option>
              {machinists.map(m => (
                <option key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? ' (me)' : ''}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          </div>
        </div>
        {assignError && <p className="text-red-500 text-xs">{assignError}</p>}
      </div>

      {/* Status */}
      <form onSubmit={handleStatusSubmit} className="space-y-2">
        <label className="block text-xs font-medium text-gray-500">Status</label>
        <div className="relative w-full">
          <select
            value={statusValue}
            onChange={e => setStatusValue(e.target.value as JobStatus)}
            className="border rounded-md px-2 py-1.5 text-sm w-full appearance-none pr-8"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
        <textarea
          value={statusNote}
          onChange={e => setStatusNote(e.target.value)}
          placeholder="Optional note about this change…"
          rows={2}
          className="border rounded-md px-2 py-1.5 text-sm w-full"
        />
        {statusError && <p className="text-red-500 text-xs">{statusError}</p>}
        <button
          type="submit"
          disabled={statusSaving || statusValue === status}
          className="bg-[#BF5700] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors"
        >
          {statusSaving ? 'Updating…' : 'Update Status'}
        </button>
      </form>

      {/* Materials */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-500">Materials</label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={materialsReq}
            disabled={materialsSaving}
            onChange={e => handleMaterialsChange('materialsRequired', e.target.checked)}
            className="rounded"
          />
          Materials required
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={materialsOrd}
            disabled={materialsSaving}
            onChange={e => handleMaterialsChange('materialsOrdered', e.target.checked)}
            className="rounded"
          />
          Materials ordered
        </label>
      </div>

      {/* Notes */}
      <form onSubmit={handleNotesSubmit} className="space-y-2">
        <label className="block text-xs font-medium text-gray-500">Machinist Notes</label>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
          rows={3}
          className="border rounded-md px-2 py-1.5 text-sm w-full"
        />
        {notesError && <p className="text-red-500 text-xs">{notesError}</p>}
        <button
          type="submit"
          disabled={notesSaving || notes === machinistNotes}
          className="px-3 py-1.5 rounded-md border text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {notesSaving ? 'Saving…' : notesSaved ? 'Saved' : 'Save Notes'}
        </button>
      </form>

      {/* Admin: destructive actions */}
      {isAdmin && (
        <div className="space-y-2 border-t pt-4">
          <label className="block text-xs font-medium text-red-600">Danger Zone</label>
          {deleteError && <p className="text-red-500 text-xs">{deleteError}</p>}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 rounded-md border border-red-300 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? 'Deleting…' : 'Delete Job'}
          </button>
        </div>
      )}
    </section>
  )
}
