import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jobs, jobItems, jobStatusHistory } from '@/lib/schema'
import { requireAuth } from '@/lib/auth'
import { createJobSchema } from '@/lib/types'
import { eq, desc, ne, and, ilike, or } from 'drizzle-orm'
import { users } from '@/lib/schema'
import { sendNewJobNotification } from '@/lib/mail'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const status  = searchParams.get('status')
    const search  = searchParams.get('search')
    const page    = parseInt(searchParams.get('page') ?? '1')
    const size    = parseInt(searchParams.get('pageSize') ?? '25')

    const conditions = []
    if (status && status !== 'all') conditions.push(eq(jobs.status, status as any))
    if (search) {
      const jobIdMatch = /^#?\d+$/.test(search) ? parseInt(search.replace('#', ''), 10) : null
      conditions.push(
        jobIdMatch !== null
          ? or(eq(jobs.id, jobIdMatch), ilike(jobs.description, `%${search}%`))
          : or(ilike(jobs.description, `%${search}%`))
      )
    }

    const results = await db
      .select({
        id:           jobs.id,
        entryDate:    jobs.entryDate,
        dateRequired: jobs.dateRequired,
        description:  jobs.description,
        status:       jobs.status,
        priority:     jobs.priority,
        requestorName: users.name,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.requestorId, users.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(jobs.id))
      .limit(size)
      .offset((page - 1) * size)

    return NextResponse.json({ jobs: results, page, pageSize: size })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const data = createJobSchema.parse(body)

    const [job] = await db.insert(jobs).values({
      dateRequired:      data.dateRequired,
      description:       data.description,
      requestorId:       parseInt(user.id as string),
      materialsRequired: data.materialsRequired,
      materialsOrdered:  data.materialsOrdered,
      accountNumber:     data.accountNumber,
      accountTitle:      data.accountTitle,
      bookkeeperName:    data.bookkeeperName,
      bookkeeperAddress: data.bookkeeperAddress,
      sponsorOrg:        data.sponsorOrg,
      sponsorSignature:  data.sponsorSignature,
    }).returning({ id: jobs.id })

    if (data.items?.length) {
      await db.insert(jobItems).values(
        data.items.map((item, i) => ({
          jobId:       job.id,
          itemNumber:  i + 1,
          partNumber:  item.partNumber,
          quantity:    item.quantity,
          description: item.description,
        }))
      )
    }

    await db.insert(jobStatusHistory).values({
      jobId:       job.id,
      fromStatus:  null,
      toStatus:    'pending',
      changedById: parseInt(user.id as string),
    })

    // Notify staff — fire-and-forget so a flaky SMTP relay can't block the
    // 201 response back to the requestor.
    const requestorRow = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, parseInt(user.id as string)))
      .limit(1)

    sendNewJobNotification({
      jobId:         job.id,
      description:   data.description,
      priority:      'normal', // new jobs always start at normal; updatable via PATCH /api/jobs/[id]
      dateRequired:  data.dateRequired,
      requestorName: requestorRow[0]?.name ?? (user.email as string) ?? 'Unknown',
    }).catch((err: unknown) => {
      console.error('[mail] failed to send new-job notification:', err)
    })

    return NextResponse.json({ id: job.id }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
