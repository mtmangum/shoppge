/**
 * One-time migration script: Drupal 7 MySQL → PostgreSQL
 *
 * Usage:
 *   1. Export Drupal DB tables to CSV (or provide direct MySQL connection string)
 *   2. Set env vars: DRUPAL_DB_URL, DATABASE_URL
 *   3. Run: npx tsx scripts/migrate-from-drupal.ts
 */

import { createPool } from 'mysql2/promise'
import { db } from '../lib/db'
import { users, jobs, jobItems } from '../lib/schema'
import bcrypt from 'bcryptjs'

const drupalDb = createPool(process.env.DRUPAL_DB_URL!)

async function migrateUsers() {
  console.log('Migrating users…')
  const [rows]: any = await (await drupalDb).query(`
    SELECT u.uid, u.name, u.mail, r.name as role
    FROM users u
    LEFT JOIN users_roles ur ON ur.uid = u.uid
    LEFT JOIN role r ON r.rid = ur.rid
    WHERE u.uid > 0
  `)

  for (const row of rows) {
    const role = row.role?.includes('admin') ? 'admin'
               : row.role?.includes('machinist') ? 'machinist'
               : 'requestor'

    await db.insert(users).values({
      // NOTE: passwords cannot be migrated (Drupal uses incompatible hash).
      // Users will use "forgot password" to set a new one, or SSO.
      email: row.mail || `${row.name}@pge.utexas.edu`,
      name:  row.name,
      role,
      passwordHash: null,
    }).onConflictDoNothing()
  }
  console.log(`  → ${rows.length} users migrated`)
}

async function migrateJobs() {
  console.log('Migrating jobs…')

  // Query the pges custom tables — adjust table/column names to match your Drupal DB
  const [rows]: any = await (await drupalDb).query(`
    SELECT
      j.job_id,
      j.entry_date,
      j.date_required,
      j.description,
      j.status,
      j.priority,
      j.materials_required,
      j.materials_ordered,
      j.date_completed,
      j.account_number,
      j.account_title,
      j.bookkeeper_name,
      j.bookkeeper_address,
      j.sponsor_org,
      ru.mail AS requestor_email,
      mu.mail AS machinist_email
    FROM pges_jobs j
    LEFT JOIN users ru ON ru.uid = j.requestor_uid
    LEFT JOIN users mu ON mu.uid = j.machinist_uid
    ORDER BY j.job_id ASC
  `)

  // Map Drupal status strings to new enum values
  const statusMap: Record<string, string> = {
    'inprogress': 'inprogress',
    'in progress': 'inprogress',
    'pending': 'pending',
    'completed': 'completed',
    'cancelled': 'cancelled',
    'deleted': 'cancelled',
  }

  for (const row of rows) {
    // Resolve user IDs from emails
    const [requestor] = await db.select({ id: users.id })
      .from(users)
      .where(db.$eq(users.email, row.requestor_email))
      .limit(1)

    const [machinist] = row.machinist_email
      ? await db.select({ id: users.id })
          .from(users)
          .where(db.$eq(users.email, row.machinist_email))
          .limit(1)
      : [null]

    await db.insert(jobs).values({
      id:               row.job_id,          // preserve original IDs
      entryDate:        row.entry_date,
      dateRequired:     row.date_required,
      description:      row.description || '(no description)',
      requestorId:      requestor?.id ?? 1,  // fallback to admin if user not found
      machinistId:      machinist?.id,
      status:           (statusMap[row.status?.toLowerCase()] ?? 'pending') as any,
      priority:         row.priority === 'urgent' ? 'urgent' : 'normal',
      materialsRequired: Boolean(row.materials_required),
      materialsOrdered:  Boolean(row.materials_ordered),
      dateCompleted:    row.date_completed || null,
      accountNumber:    row.account_number,
      accountTitle:     row.account_title,
      bookkeeperName:   row.bookkeeper_name,
      bookkeeperAddress: row.bookkeeper_address,
      sponsorOrg:       row.sponsor_org,
    }).onConflictDoNothing()
  }

  // Reset sequence so new jobs don't conflict with migrated IDs
  await db.execute(
    db.sql`SELECT setval('jobs_id_seq', (SELECT MAX(id) FROM jobs))`
  )

  console.log(`  → ${rows.length} jobs migrated`)
}

async function main() {
  console.log('Starting Drupal → PostgreSQL migration\n')
  await migrateUsers()
  await migrateJobs()
  console.log('\nMigration complete!')
  process.exit(0)
}

main().catch(e => {
  console.error('Migration failed:', e)
  process.exit(1)
})
