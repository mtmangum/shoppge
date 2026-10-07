import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 12

// bcrypt only uses the first 72 bytes, so reject anything longer rather than
// silently truncating it.
export const newPasswordSchema = z.string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(72)
  .refine(value => new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 bytes')
