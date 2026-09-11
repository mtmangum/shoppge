'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createJobSchema, type CreateJobSchema } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'

export default function NewJobPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [createdJobId, setCreatedJobId] = useState<number | null>(null)

  const { register, control, handleSubmit, formState: { errors } } = useForm<CreateJobSchema>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      materialsRequired: false,
      materialsOrdered: false,
      items: [{ partNumber: '', quantity: '', description: '' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const onSubmit = async (data: CreateJobSchema) => {
    setSubmitting(true)
    setError(null)
    try {
      // If a previous attempt already created the job and only the
      // attachment upload failed, retry the upload against that job
      // instead of submitting the form again (which would create a
      // second job).
      let id = createdJobId
      if (id === null) {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error(await res.text())
        ;({ id } = await res.json())
        setCreatedJobId(id)
      }

      if (file) {
        const uploadForm = new FormData()
        uploadForm.append('file', file)
        const uploadRes = await fetch(`/api/jobs/${id}/attachments`, { method: 'POST', body: uploadForm })
        if (!uploadRes.ok) {
          const { error: uploadError } = await uploadRes.json().catch(() => ({ error: 'Attachment upload failed' }))
          setError(`Job #${id} was created, but the attachment failed to upload: ${uploadError ?? 'unknown error'}.`)
          setSubmitting(false)
          return
        }
      }

      router.push(`/jobs/${id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Submit New Job</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Info */}
        <fieldset disabled={createdJobId !== null} className="disabled:opacity-50">
        <section className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-700 border-b pb-2">Job Details</h3>

          <div>
            <label htmlFor="job-date-required" className="block text-sm font-medium text-gray-700 mb-1">
              Date Required <span className="text-red-500">*</span>
            </label>
            <input
              id="job-date-required"
              type="date"
              {...register('dateRequired')}
              className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
            />
            {errors.dateRequired && (
              <p className="text-red-500 text-xs mt-1">{errors.dateRequired.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 mb-1">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="job-description"
              {...register('description')}
              rows={3}
              placeholder="Describe what you need machined…"
              className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
            />
            {errors.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('materialsRequired')} className="rounded" />
              Materials required?
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register('materialsOrdered')} className="rounded" />
              Materials ordered?
            </label>
          </div>
        </section>
        </fieldset>

        {/* Line Items */}
        <section className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-700 border-b pb-2">Item List</h3>

          <fieldset disabled={createdJobId !== null} className="space-y-4 disabled:opacity-50">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-start pb-3 sm:pb-0 border-b sm:border-0 last:border-b-0 last:pb-0">
              <div className="sm:col-span-3">
                {i === 0 && <label className="block text-xs text-gray-500 mb-1">Part #</label>}
                <input
                  {...register(`items.${i}.partNumber`)}
                  placeholder="Part #"
                  aria-label={`Part number for item ${i + 1}`}
                  className="border rounded px-2 py-1.5 text-sm w-full"
                />
              </div>
              <div className="sm:col-span-2">
                {i === 0 && <label className="block text-xs text-gray-500 mb-1">Qty</label>}
                <input
                  {...register(`items.${i}.quantity`)}
                  placeholder="Qty"
                  aria-label={`Quantity for item ${i + 1}`}
                  className="border rounded px-2 py-1.5 text-sm w-full"
                />
              </div>
              <div className="sm:col-span-6">
                {i === 0 && <label className="block text-xs text-gray-500 mb-1">Description</label>}
                <input
                  {...register(`items.${i}.description`)}
                  placeholder="Description"
                  aria-label={`Description for item ${i + 1}`}
                  className="border rounded px-2 py-1.5 text-sm w-full"
                />
              </div>
              <div className="sm:col-span-1 flex justify-end sm:items-end sm:pb-0.5">
                {i === 0 && <div className="hidden sm:block h-5" />}
                {fields.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 p-1" aria-label={`Remove item ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => append({ partNumber: '', quantity: '', description: '' })}
            className="flex items-center gap-1 text-sm text-[#BF5700] hover:underline"
          >
            <Plus className="h-4 w-4" /> Add item
          </button>
          </fieldset>

          {/* File upload */}
          <div className="pt-2">
            <label htmlFor="job-attachment" className="block text-sm font-medium text-gray-700 mb-1">
              Attach Drawing (PDF only)
            </label>
            <input
              id="job-attachment"
              type="file"
              accept=".pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border file:text-sm file:cursor-pointer"
            />
            <p className="text-xs text-gray-400 mt-1">Optional. You can also add more from the job page after submitting.</p>
          </div>
        </section>

        {/* Sponsor Info */}
        <fieldset disabled={createdJobId !== null} className="disabled:opacity-50">
        <section className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-700 border-b pb-2">Billing / Sponsor Information</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="job-account-number" className="block text-xs text-gray-500 mb-1">Account Number</label>
              <input id="job-account-number" {...register('accountNumber')} placeholder="00-0000-0000"
                className="border rounded-md px-3 py-2 w-full text-sm" />
            </div>
            <div>
              <label htmlFor="job-account-title" className="block text-xs text-gray-500 mb-1">Account Title</label>
              <input id="job-account-title" {...register('accountTitle')}
                className="border rounded-md px-3 py-2 w-full text-sm" />
            </div>
            <div>
              <label htmlFor="job-sponsor-org" className="block text-xs text-gray-500 mb-1">Sponsoring Faculty/Organization</label>
              <input id="job-sponsor-org" {...register('sponsorOrg')}
                className="border rounded-md px-3 py-2 w-full text-sm" />
            </div>
            <div>
              <label htmlFor="job-bookkeeper-name" className="block text-xs text-gray-500 mb-1">Account Bookkeeper</label>
              <input id="job-bookkeeper-name" {...register('bookkeeperName')}
                className="border rounded-md px-3 py-2 w-full text-sm" />
            </div>
            <div className="col-span-2">
              <label htmlFor="job-bookkeeper-address" className="block text-xs text-gray-500 mb-1">Bookkeeper Address</label>
              <textarea id="job-bookkeeper-address" {...register('bookkeeperAddress')} rows={2}
                className="border rounded-md px-3 py-2 w-full text-sm" />
            </div>
          </div>
        </section>
        </fieldset>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded p-3">
            {error}
            {createdJobId && (
              <>
                {' '}
                <Link href={`/jobs/${createdJobId}`} className="underline font-medium">
                  Go to Job #{createdJobId}
                </Link>
              </>
            )}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#BF5700] text-white px-6 py-2 rounded-md font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting…' : createdJobId !== null ? 'Retry Attachment Upload' : 'Submit Job'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 rounded-md border font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
