import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jobAttachments, jobs } from '@/lib/schema'
import { requireAuth } from '@/lib/auth'
import { uploadAttachment } from '@/lib/s3'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const jobId = parseInt(params.id)

    const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, PNG, JPEG.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 25MB limit.' }, { status: 400 })
    }

    const storageKey = `jobs/${jobId}/${randomUUID()}-${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadAttachment(storageKey, buffer, file.type)

    const [attachment] = await db.insert(jobAttachments).values({
      jobId,
      originalName: file.name,
      storageKey,
      fileSizeBytes: file.size,
      mimeType: file.type,
      uploadedById: parseInt(user.id as string),
    }).returning()

    return NextResponse.json({ attachment }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
