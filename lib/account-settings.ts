import { z } from 'zod'

export const profileSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(255),
  department: z.string().trim().max(100),
  phone: z.string().trim().max(30),
  room: z.string().trim().max(50),
}).strict()

export const passwordSettingsSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(1024),
  newPassword: z.string().min(8, 'Use at least 8 characters').max(72)
    .refine(value => new TextEncoder().encode(value).length <= 72, 'Password must be at most 72 bytes'),
}).strict().refine(value => value.currentPassword !== value.newPassword, {
  message: 'Choose a different new password', path: ['newPassword'],
})

export type ProfileSettings = z.infer<typeof profileSettingsSchema>
export type ThemePreference = 'light' | 'dark' | 'system'
export const THEME_COOKIE = 'shoptrack-theme'

export function parseTheme(value?: string): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}
