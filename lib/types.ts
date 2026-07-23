// ============================================================
// Core domain types — mirror the database schema
// ============================================================

export type JobStatus = 'pending' | 'inprogress' | 'completed' | 'cancelled'
export type JobPriority = 'normal' | 'urgent'
export type UserRole = 'requestor' | 'machinist' | 'admin'

export interface User {
  id: number
  email: string
  name: string
  role: UserRole
  department?: string
  phone?: string
  room?: string
  isActive: boolean
  createdAt: Date
}

export interface JobItem {
  id: number
  jobId: number
  itemNumber: number
  partNumber?: string
  quantity?: string
  description?: string
}

export interface JobAttachment {
  id: number
  jobId: number
  originalName: string
  storageKey: string
  fileSizeBytes?: number
  mimeType: string
  uploadedById?: number
  uploadedAt: Date
}

export interface JobStatusHistory {
  id: number
  jobId: number
  fromStatus?: JobStatus
  toStatus: JobStatus
  changedById?: number
  changedByName?: string
  note?: string
  changedAt: Date
}

export interface Job {
  id: number
  entryDate: string            // ISO date string
  dateRequired: string         // ISO date string
  description: string
  requestorId: number
  requestorName?: string
  machinistId?: number
  machinistName?: string
  status: JobStatus
  priority: JobPriority
  materialsRequired: boolean
  materialsOrdered: boolean
  dateCompleted?: string
  accountNumber?: string
  accountTitle?: string
  bookkeeperName?: string
  bookkeeperAddress?: string
  sponsorOrg?: string
  sponsorSignature?: string
  machinistNotes?: string
  daysElapsed?: number
  items?: JobItem[]
  attachments?: JobAttachment[]
  statusHistory?: JobStatusHistory[]
  createdAt: Date
  updatedAt: Date
}

// ============================================================
// API request/response types
// ============================================================

export interface JobListItem {
  id: number
  entryDate: string
  dateRequired: string
  description: string
  requestorName: string
  machinistName?: string
  status: JobStatus
  priority: JobPriority
  daysElapsed: number
}

export interface JobsResponse {
  jobs: JobListItem[]
  total: number
  page: number
  pageSize: number
}

export interface JobFilters {
  status?: JobStatus | 'all'
  priority?: JobPriority | 'all'
  machinistId?: number | 'all'
  search?: string
  page?: number
  pageSize?: number
}

export interface CreateJobInput {
  dateRequired: string
  description: string
  materialsRequired: boolean
  materialsOrdered: boolean
  items: Array<{
    partNumber?: string
    quantity?: string
    description?: string
  }>
  accountNumber?: string
  accountTitle?: string
  bookkeeperName?: string
  bookkeeperAddress?: string
  sponsorOrg?: string
  sponsorSignature?: string
}

export interface UpdateJobStatusInput {
  status: JobStatus
  note?: string
}

// ============================================================
// Zod schemas (validation)
// ============================================================
import { z } from 'zod'

export const createJobSchema = z.object({
  dateRequired: z.string().min(1, 'Date required is required'),
  description: z.string().min(5, 'Description must be at least 5 characters').max(2000),
  materialsRequired: z.boolean().default(false),
  materialsOrdered: z.boolean().default(false),
  items: z.array(z.object({
    partNumber: z.string().optional(),
    quantity: z.string().optional(),
    description: z.string().optional(),
  })).min(1, 'At least one item is required'),
  accountNumber: z.string().optional(),
  accountTitle: z.string().optional(),
  bookkeeperName: z.string().optional(),
  bookkeeperAddress: z.string().optional(),
  sponsorOrg: z.string().optional(),
  sponsorSignature: z.string().optional(),
})

export type CreateJobSchema = z.infer<typeof createJobSchema>

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'inprogress', 'completed', 'cancelled']),
  note: z.string().optional(),
})

export const updateJobSchema = z.object({
  machinistId: z.number().nullable().optional(),
  materialsRequired: z.boolean().optional(),
  materialsOrdered: z.boolean().optional(),
  machinistNotes: z.string().optional(),
  priority: z.enum(['normal', 'urgent']).optional(),
})

export type UpdateJobInput = z.infer<typeof updateJobSchema>

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Must be a valid email'),
  role: z.enum(['requestor', 'machinist', 'admin']).default('requestor'),
  department: z.string().optional(),
  phone: z.string().optional(),
  room: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['requestor', 'machinist', 'admin']).optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  room: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>
