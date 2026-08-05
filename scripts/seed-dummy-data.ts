/**
 * Dev-only seed script: populates a handful of test users and jobs so the
 * UI has something to show in a fresh environment.
 *
 * Usage:
 *   npx tsx scripts/seed-dummy-data.ts
 */

import { db } from '../lib/db'
import { users, jobs, jobItems, jobStatusHistory } from '../lib/schema'
import bcrypt from 'bcryptjs'

const SEED_PASSWORD = 'password123'

async function seedUsers() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)

  const rows = [
    { email: 'jsmith@utexas.edu', name: 'Jane Smith', role: 'requestor' as const, department: 'Petroleum Engineering', room: 'CPE 2.204' },
    { email: 'rjones@utexas.edu', name: 'Robert Jones', role: 'requestor' as const, department: 'Mechanical Engineering', room: 'ETC 4.150' },
    { email: 'mchen@utexas.edu', name: 'Mei Chen', role: 'machinist' as const, department: 'PGE Shop', room: 'CPE B0.200' },
    { email: 'dwilson@utexas.edu', name: 'Dave Wilson', role: 'machinist' as const, department: 'PGE Shop', room: 'CPE B0.200' },
  ]

  for (const row of rows) {
    await db.insert(users).values({ ...row, passwordHash }).onConflictDoNothing()
  }

  const inserted = await db.select({ id: users.id, email: users.email, role: users.role }).from(users)
  console.log(`  → ${rows.length} test users ensured (password: "${SEED_PASSWORD}")`)
  return inserted
}

async function seedJobs(allUsers: { id: number; email: string; role: string }[]) {
  const existing = await db.select({ id: jobs.id }).from(jobs).limit(1)
  if (existing.length > 0) {
    console.log('  → jobs already exist, skipping (delete existing jobs first to reseed)')
    return
  }

  const requestors = allUsers.filter(u => u.role === 'requestor')
  const machinists = allUsers.filter(u => u.role === 'machinist')
  const admin = allUsers.find(u => u.role === 'admin')

  const today = new Date()
  const daysFromNow = (n: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  const jobDefs = [
    {
      description: 'Machine 6 aluminum brackets for downhole sensor mount',
      requestorId: requestors[0].id,
      machinistId: machinists[0].id,
      status: 'inprogress' as const,
      priority: 'normal' as const,
      dateRequired: daysFromNow(7),
      accountNumber: '14-1234567',
      accountTitle: 'PGE Research Fund',
      items: [
        { itemNumber: 1, partNumber: 'AL-6061', quantity: '6', description: '2in x 2in x 0.5in aluminum bracket' },
      ],
    },
    {
      description: 'Repair broken fitting on core flooding rig',
      requestorId: requestors[1].id,
      machinistId: machinists[1].id,
      status: 'completed' as const,
      priority: 'urgent' as const,
      dateRequired: daysFromNow(-3),
      dateCompleted: daysFromNow(-1),
      completedById: machinists[1].id,
      accountNumber: '14-7654321',
      accountTitle: 'Core Flooding Lab',
      items: [
        { itemNumber: 1, partNumber: null, quantity: '1', description: 'Repair 1/4in NPT stainless fitting' },
      ],
    },
    {
      description: 'Fabricate custom sample holder for triaxial test cell',
      requestorId: requestors[0].id,
      machinistId: null,
      status: 'pending' as const,
      priority: 'normal' as const,
      dateRequired: daysFromNow(14),
      materialsRequired: true,
      accountNumber: '14-1234567',
      accountTitle: 'PGE Research Fund',
      items: [
        { itemNumber: 1, partNumber: 'SS-316', quantity: '2', description: 'Cylindrical sample holder, 1.5in diameter' },
        { itemNumber: 2, partNumber: null, quantity: '4', description: 'O-ring seals, size to match holder' },
      ],
    },
    {
      description: 'Cut and drill mounting plate for pressure transducer array',
      requestorId: requestors[1].id,
      machinistId: machinists[0].id,
      status: 'inprogress' as const,
      priority: 'normal' as const,
      dateRequired: daysFromNow(10),
      accountNumber: '14-9988776',
      accountTitle: 'Reservoir Simulation Lab',
      items: [
        { itemNumber: 1, partNumber: 'AL-6061', quantity: '1', description: '12in x 8in x 0.25in mounting plate' },
      ],
    },
    {
      description: 'Job cancelled — request superseded by vendor part',
      requestorId: requestors[0].id,
      machinistId: null,
      status: 'cancelled' as const,
      priority: 'normal' as const,
      dateRequired: daysFromNow(5),
      accountNumber: '14-1234567',
      accountTitle: 'PGE Research Fund',
      items: [],
    },
  ]

  let jobCount = 0
  let itemCount = 0

  for (const def of jobDefs) {
    const { items, ...jobValues } = def

    const [job] = await db.insert(jobs).values(jobValues).returning({ id: jobs.id })
    jobCount++

    for (const item of items) {
      await db.insert(jobItems).values({ jobId: job.id, ...item })
      itemCount++
    }

    await db.insert(jobStatusHistory).values({
      jobId: job.id,
      fromStatus: null,
      toStatus: 'pending',
      changedById: admin?.id ?? job.requestorId,
      note: 'Job created (seed data)',
    })

    if (jobValues.status !== 'pending') {
      await db.insert(jobStatusHistory).values({
        jobId: job.id,
        fromStatus: 'pending',
        toStatus: jobValues.status,
        changedById: jobValues.machinistId ?? admin?.id ?? job.requestorId,
        note: 'Status updated (seed data)',
      })
    }
  }

  console.log(`  → ${jobCount} test jobs created (${itemCount} line items)`)
}

async function main() {
  console.log('Seeding dummy data\n')
  const allUsers = await seedUsers()
  await seedJobs(allUsers)
  console.log('\nDone.')
  process.exit(0)
}

main().catch(e => {
  console.error('Seeding failed:', e)
  process.exit(1)
})
