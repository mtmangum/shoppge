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

  const accounts = [
    { accountNumber: '14-1234567', accountTitle: 'PGE Research Fund' },
    { accountNumber: '14-7654321', accountTitle: 'Core Flooding Lab' },
    { accountNumber: '14-9988776', accountTitle: 'Reservoir Simulation Lab' },
    { accountNumber: '14-2231445', accountTitle: 'Drilling Fluids Lab' },
    { accountNumber: '14-5566778', accountTitle: 'Rock Mechanics Lab' },
  ]

  const taskTemplates: { description: string; partNumber: string | null; itemDescription: string; quantity: string }[] = [
    { description: 'Machine aluminum brackets for downhole sensor mount', partNumber: 'AL-6061', itemDescription: '2in x 2in x 0.5in aluminum bracket', quantity: '6' },
    { description: 'Repair broken fitting on core flooding rig', partNumber: null, itemDescription: 'Repair 1/4in NPT stainless fitting', quantity: '1' },
    { description: 'Fabricate custom sample holder for triaxial test cell', partNumber: 'SS-316', itemDescription: 'Cylindrical sample holder, 1.5in diameter', quantity: '2' },
    { description: 'Cut and drill mounting plate for pressure transducer array', partNumber: 'AL-6061', itemDescription: '12in x 8in x 0.25in mounting plate', quantity: '1' },
    { description: 'Fabricate replacement piston for hydraulic ram', partNumber: 'SS-304', itemDescription: '3in diameter piston, precision ground', quantity: '1' },
    { description: 'Weld repair on core storage rack frame', partNumber: null, itemDescription: 'MIG weld repair, structural steel frame', quantity: '1' },
    { description: 'Turn and thread adapter fittings for flow loop', partNumber: 'SS-316', itemDescription: '1/2in NPT to 3/8in compression adapter', quantity: '8' },
    { description: 'Machine acrylic viewing window for pressure cell', partNumber: 'ACRYLIC-CAST', itemDescription: '4in diameter x 0.75in thick acrylic disc', quantity: '2' },
    { description: 'Build custom cart for portable core scanner', partNumber: null, itemDescription: 'Welded steel frame cart with locking casters', quantity: '1' },
    { description: 'Drill and tap mounting holes in instrument enclosure', partNumber: null, itemDescription: '10-24 tapped holes, aluminum enclosure', quantity: '12' },
    { description: 'Fabricate spacer rings for centrifuge rotor', partNumber: 'AL-7075', itemDescription: '2in OD x 1in ID spacer ring', quantity: '4' },
    { description: 'Repair stripped threads on pressure vessel end cap', partNumber: null, itemDescription: 'Heli-coil insert repair, 1/2-13 UNC', quantity: '3' },
    { description: 'Machine custom coupling for stepper motor shaft', partNumber: 'AL-6061', itemDescription: '0.25in to 0.375in flexible shaft coupling', quantity: '1' },
    { description: 'Cut gasket material for flange assembly', partNumber: 'GASKET-VITON', itemDescription: '6in flange gasket, cut to spec', quantity: '5' },
    { description: 'Fabricate sensor bracket for wellbore simulator', partNumber: 'SS-316', itemDescription: 'L-bracket with slotted mounting holes', quantity: '3' },
    { description: 'Modify existing fixture for new sample geometry', partNumber: null, itemDescription: 'Mill fixture to accept 2in core plugs', quantity: '1' },
    { description: 'Machine polycarbonate cover for electronics enclosure', partNumber: 'POLYCARB', itemDescription: '8in x 6in x 0.25in cover plate', quantity: '1' },
    { description: 'Fabricate custom test stand for load cell calibration', partNumber: null, itemDescription: 'Welded aluminum frame, adjustable height', quantity: '1' },
    { description: 'Repair leaking valve body on injection pump', partNumber: null, itemDescription: 'Re-machine valve seat, stainless body', quantity: '1' },
    { description: 'Machine set screws collar for shaft extension', partNumber: 'SS-303', itemDescription: '1in bore shaft collar with set screws', quantity: '4' },
  ]

  const dateOffsets = [-45, -38, -30, -25, -20, -18, -14, -10, -7, -5, -3, -1, 0, 2, 4, 6, 8, 10, 14, 18, 21, 25, 28, 32, 35, 40, 45, 50, 55, 60]

  const jobDefs = dateOffsets.map((offset, i) => {
    const task = taskTemplates[i % taskTemplates.length]
    const account = accounts[i % accounts.length]
    const requestor = requestors[i % requestors.length]
    const machinist = machinists[i % machinists.length]

    // Roughly: 40% completed, 25% inprogress, 25% pending, 10% cancelled
    const statusRoll = i % 10
    const status = statusRoll < 4 ? 'completed' as const
                 : statusRoll < 6.5 ? 'inprogress' as const
                 : statusRoll < 9 ? 'pending' as const
                 : 'cancelled' as const

    const dateRequired = daysFromNow(offset)
    const isPastDue = status === 'completed'

    return {
      description: task.description,
      requestorId: requestor.id,
      machinistId: status === 'pending' ? null : machinist.id,
      status,
      priority: (i % 6 === 0 ? 'urgent' : 'normal') as const,
      dateRequired,
      materialsRequired: i % 4 === 0,
      dateCompleted: isPastDue ? daysFromNow(offset - 2) : undefined,
      completedById: isPastDue ? machinist.id : undefined,
      ...account,
      items: task.partNumber === null && i % 3 === 0
        ? []
        : [{ itemNumber: 1, partNumber: task.partNumber, quantity: task.quantity, description: task.itemDescription }],
    }
  })

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
