import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jobAttachments } from '@/lib/schema'
import { requireAuth, requireMachinist } from '@/lib/auth'
import { getAttachmentDownloadUrl, deleteAttachment } from '@/lib/s3'
import { and, eq } from 'drizzle-orm'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    await requireAuth()
    const [attachment] = await db
      .select()
      .from(jobAttachments)
      .where(and(
        eq(jobAttachments.id, parseInt(params.attachmentId)),
        eq(jobAttachments.jobId, parseInt(params.id)),
      ))
      .limit(1)

    if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

    const url = await getAttachmentDownloadUrl(attachment.storageKey)
    return NextResponse.redirect(url)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  try {
    await requireMachinist()
    const [attachment] = await db
      .select()
      .from(jobAttachments)
      .where(and(
        eq(jobAttachments.id, parseInt(params.attachmentId)),
        eq(jobAttachments.jobId, parseInt(params.id)),
      ))
      .limit(1)

    if (!attachment) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })

    await deleteAttachment(attachment.storageKey)
    await db.delete(jobAttachments).where(eq(jobAttachments.id, attachment.id))

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : e.message?.startsWith('Forbidden:') ? 403 : 400
    return NextResponse.json({ error: e.message }, { status })
  }
}
