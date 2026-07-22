// Drizzle ORM schema — mirrors schema.sql
import {
  pgTable, pgEnum, serial, integer, varchar, text,
  boolean, date, timestamp, uniqueIndex, index
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================
// Enums
// ============================================================
export const jobStatusEnum   = pgEnum('job_status',   ['pending', 'inprogress', 'completed', 'cancelled'])
export const jobPriorityEnum = pgEnum('job_priority', ['normal', 'urgent'])
export const userRoleEnum    = pgEnum('user_role',    ['requestor', 'machinist', 'admin'])

// ============================================================
// Users
// ============================================================
export const users = pgTable('users', {
  id:           serial('id').primaryKey(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  name:         varchar('name', { length: 255 }).notNull(),
  role:         userRoleEnum('role').notNull().default('requestor'),
  passwordHash: text('password_hash'),
  eid:          varchar('eid', { length: 50 }),
  department:   varchar('department', { length: 100 }),
  phone:        varchar('phone', { length: 30 }),
  room:         varchar('room', { length: 50 }),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================================
// Jobs
// ============================================================
export const jobs = pgTable('jobs', {
  id:               serial('id').primaryKey(),
  entryDate:        date('entry_date').notNull().defaultNow(),
  dateRequired:     date('date_required').notNull(),
  description:      text('description').notNull(),
  requestorId:      integer('requestor_id').notNull().references(() => users.id),
  machinistId:      integer('machinist_id').references(() => users.id),
  status:           jobStatusEnum('status').notNull().default('pending'),
  priority:         jobPriorityEnum('priority').notNull().default('normal'),
  materialsRequired: boolean('materials_required').notNull().default(false),
  materialsOrdered:  boolean('materials_ordered').notNull().default(false),
  dateCompleted:    date('date_completed'),
  completedById:    integer('completed_by_id').references(() => users.id),
  accountNumber:    varchar('account_number', { length: 50 }),
  accountTitle:     varchar('account_title', { length: 255 }),
  bookkeeperName:   varchar('bookkeeper_name', { length: 255 }),
  bookkeeperAddress: text('bookkeeper_address'),
  sponsorOrg:       varchar('sponsor_org', { length: 255 }),
  sponsorSignature: varchar('sponsor_signature', { length: 255 }),
  machinistNotes:   text('machinist_notes'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================================
// Job Items
// ============================================================
export const jobItems = pgTable('job_items', {
  id:          serial('id').primaryKey(),
  jobId:       integer('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  itemNumber:  integer('item_number').notNull(),
  partNumber:  varchar('part_number', { length: 100 }),
  quantity:    varchar('quantity', { length: 50 }),
  description: text('description'),
})

// ============================================================
// Job Attachments
// ============================================================
export const jobAttachments = pgTable('job_attachments', {
  id:             serial('id').primaryKey(),
  jobId:          integer('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  originalName:   varchar('original_name', { length: 255 }).notNull(),
  storageKey:     varchar('storage_key', { length: 500 }).notNull(),
  fileSizeBytes:  integer('file_size_bytes'),
  mimeType:       varchar('mime_type', { length: 100 }).default('application/pdf'),
  uploadedById:   integer('uploaded_by_id').references(() => users.id),
  uploadedAt:     timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================================
// Job Status History
// ============================================================
export const jobStatusHistory = pgTable('job_status_history', {
  id:          serial('id').primaryKey(),
  jobId:       integer('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  fromStatus:  jobStatusEnum('from_status'),
  toStatus:    jobStatusEnum('to_status').notNull(),
  changedById: integer('changed_by_id').references(() => users.id),
  note:        text('note'),
  changedAt:   timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
})

// ============================================================
// Relations
// ============================================================
export const jobsRelations = relations(jobs, ({ one, many }) => ({
  requestor:     one(users, { fields: [jobs.requestorId], references: [users.id] }),
  machinist:     one(users, { fields: [jobs.machinistId], references: [users.id] }),
  completedBy:   one(users, { fields: [jobs.completedById], references: [users.id] }),
  items:         many(jobItems),
  attachments:   many(jobAttachments),
  statusHistory: many(jobStatusHistory),
}))

export const jobItemsRelations = relations(jobItems, ({ one }) => ({
  job: one(jobs, { fields: [jobItems.jobId], references: [jobs.id] }),
}))

export const jobAttachmentsRelations = relations(jobAttachments, ({ one }) => ({
  job:        one(jobs, { fields: [jobAttachments.jobId], references: [jobs.id] }),
  uploadedBy: one(users, { fields: [jobAttachments.uploadedById], references: [users.id] }),
}))

export const jobStatusHistoryRelations = relations(jobStatusHistory, ({ one }) => ({
  job:       one(jobs, { fields: [jobStatusHistory.jobId], references: [jobs.id] }),
  changedBy: one(users, { fields: [jobStatusHistory.changedById], references: [users.id] }),
}))
