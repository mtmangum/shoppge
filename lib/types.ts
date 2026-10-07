// ============================================================
// Core domain types — mirror the database schema
// ============================================================

export type JobStatus = 'pending' | 'inprogress' | 'completed' | 'cancelled'
export type JobPriority = 'normal' | 'urgent'
export type UserRole = 'requestor' | 'machinist' | 'admin'

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

// ============================================================
// Zod schemas (validation)
// ============================================================
import { z } from 'zod'
import { newPasswordSchema } from '@/lib/password-policy'

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

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Must be a valid email'),
  role: z.enum(['requestor', 'machinist', 'admin']).default('requestor'),
  department: z.string().optional(),
  phone: z.string().optional(),
  room: z.string().optional(),
  password: newPasswordSchema.optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email('Must be a valid email').optional(),
  role: z.enum(['requestor', 'machinist', 'admin']).optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  room: z.string().optional(),
  isActive: z.boolean().optional(),
  password: newPasswordSchema.optional(),
})

export const createAccessRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Must be a valid email'),
  department: z.string().optional(),
  phone: z.string().optional(),
  reason: z.string().max(2000).optional(),
})

export const reviewAccessRequestSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  role: z.enum(['requestor', 'machinist', 'admin']).optional(),
  password: newPasswordSchema.optional(),
  reviewNote: z.string().optional(),
})
