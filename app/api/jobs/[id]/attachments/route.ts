import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jobAttachments, jobs } from '@/lib/schema'
import { requireAuth, isJobOwnerOrElevated } from '@/lib/auth'
import { uploadAttachment } from '@/lib/s3'
import { sniffFileType } from '@/lib/file-type'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const jobId = parseInt(params.id)

    const [job] = await db.select({ id: jobs.id, requestorId: jobs.requestorId }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    // Requestors can only attach files to their own jobs; machinists/admins
    // can attach to any job (they need to add reference files while working
    // unassigned or assigned work alike).
    if (!isJobOwnerOrElevated(user, job)) {
      return NextResponse.json({ error: 'Forbidden: not your job' }, { status: 403 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 25MB limit.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // Verify actual file content against magic bytes rather than trusting
    // the client-supplied File.type, which is trivially spoofable.
    const realType = sniffFileType(buffer)
    if (!realType) {
      return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, PNG, JPEG.' }, { status: 400 })
    }

    const storageKey = `jobs/${jobId}/${randomUUID()}-${file.name}`
    await uploadAttachment(storageKey, buffer, realType)

    const [attachment] = await db.insert(jobAttachments).values({
      jobId,
      originalName: file.name,
      storageKey,
      fileSizeBytes: file.size,
      mimeType: realType,
      uploadedById: parseInt(user.id as string),
    }).returning()

    return NextResponse.json({ attachment }, { status: 201 })
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : 400
    return NextResponse.json({ error: e.message }, { status })
  }
}
