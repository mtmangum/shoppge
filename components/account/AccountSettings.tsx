'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Laptop, Moon, Sun } from 'lucide-react'
import { profileSettingsSchema, THEME_COOKIE, type ProfileSettings, type ThemePreference } from '@/lib/account-settings'
import type { UserRole } from '@/lib/types'

interface Account {
  name: string
  email: string
  role: UserRole
  department: string | null
  phone: string | null
  room: string | null
}

const fieldClass = 'block h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm'
const buttonClass = 'rounded-md bg-[#BF5700] px-4 py-2 text-sm font-medium text-white hover:bg-[#a34800] disabled:opacity-50'
const roles = { admin: 'Admin', machinist: 'Machinist', requestor: 'Requestor' }
const profileFields = [
  { key: 'name', label: 'Name', max: 255, autoComplete: 'name' },
  { key: 'department', label: 'Department', max: 100, autoComplete: 'organization' },
  { key: 'phone', label: 'Phone', max: 30, autoComplete: 'tel' },
  { key: 'room', label: 'Room', max: 50, autoComplete: 'off' },
] as const

export function AccountSettings({ account, initialTheme }: { account: Account; initialTheme: ThemePreference }) {
  const router = useRouter()
  const initialProfile = { name: account.name, department: account.department ?? '', phone: account.phone ?? '', room: account.room ?? '' }
  const [profile, setProfile] = useState<ProfileSettings>(initialProfile)
  const [savedProfile, setSavedProfile] = useState<ProfileSettings>(initialProfile)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ProfileSettings, string[]>>>({})
  const [profileSaved, setProfileSaved] = useState(false)
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [theme, setTheme] = useState(initialTheme)
  const [themeMessage, setThemeMessage] = useState('')
  const dirty = profileFields.some(({ key }) => profile[key] !== savedProfile[key])

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (savingProfile || !dirty) return
    setProfileError('')
    setProfileSaved(false)
    const parsed = profileSettingsSchema.safeParse(profile)
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors)
      setProfileError('Check the highlighted fields.')
      return
    }
    setFieldErrors({})
    setSavingProfile(true)
    try {
      const response = await fetch('/api/account', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) })
      const data = await response.json()
      if (!response.ok) {
        setFieldErrors(data.fields ?? {})
        throw new Error(data.error || 'Could not save your profile.')
      }
      setProfile(data.profile)
      setSavedProfile(data.profile)
      setProfileSaved(true)
      router.refresh()
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save your profile. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault()
    if (savingPassword) return
    setPasswordError('')
    setPasswordSaved(false)
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    if (passwords.currentPassword === passwords.newPassword) {
      setPasswordError('Choose a different new password.')
      return
    }
    setSavingPassword(true)
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not change your password.')
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordSaved(true)
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change your password. Please try again.')
    } finally {
      setSavingPassword(false)
    }
  }

  function changeTheme(value: ThemePreference) {
    setTheme(value)
    document.documentElement.dataset.theme = value
    try {
      document.cookie = `${THEME_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`
      const persisted = document.cookie.split(';').some(cookie => cookie.trim() === `${THEME_COOKIE}=${value}`)
      setThemeMessage(persisted ? 'Appearance saved for this browser.' : 'Appearance applied. Enable cookies to remember it next time.')
      if (persisted) router.refresh()
    } catch {
      setThemeMessage('Appearance applied for this visit; your browser could not save it.')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Account Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Manage your profile, password, and appearance.</p>
      </div>

      <section aria-labelledby="profile-heading" className="rounded-lg border bg-white p-5 shadow-sm sm:p-6">
        <h3 id="profile-heading" className="font-semibold text-gray-900">Profile</h3>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-gray-500">Email</dt><dd className="mt-1 break-words">{account.email}</dd></div>
          <div><dt className="text-gray-500">Role</dt><dd className="mt-1">{roles[account.role]}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-gray-500">
          {account.role === 'admin'
            ? <>Email and roles are managed on the <Link href="/admin/users" className="text-[#BF5700] underline">Users page</Link>. Your own Admin role is protected.</>
            : 'Contact an Admin to change your email or role.'}
        </p>
        <form onSubmit={saveProfile} className="mt-5">
          <fieldset disabled={savingProfile} className="space-y-4">
            <legend className="sr-only">Edit profile details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {profileFields.map(({ key, label, max, autoComplete }) => (
                <div key={key}>
                  <label htmlFor={`profile-${key}`} className="mb-1 block text-sm font-medium text-gray-700">{label}{key === 'name' ? ' (required)' : ''}</label>
                  <input
                    id={`profile-${key}`} name={key} type={key === 'phone' ? 'tel' : 'text'}
                    required={key === 'name'} maxLength={max} autoComplete={autoComplete}
                    className={fieldClass} value={profile[key]}
                    aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `profile-${key}-error` : undefined}
                    onChange={event => { setProfile({ ...profile, [key]: event.target.value }); setProfileSaved(false); setProfileError(''); setFieldErrors({ ...fieldErrors, [key]: undefined }) }}
                  />
                  {fieldErrors[key] && <p id={`profile-${key}-error`} className="mt-1 text-xs text-red-600">{fieldErrors[key]?.[0]}</p>}
                </div>
              ))}
            </div>
            <button type="submit" disabled={savingProfile || !dirty} className={buttonClass}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
          </fieldset>
          {profileError && <p role="alert" className="mt-3 text-sm text-red-600">{profileError}</p>}
          <p role="status" className="mt-2 text-sm text-green-600">{profileSaved ? 'Profile saved.' : ''}</p>
        </form>
      </section>

      <section aria-labelledby="appearance-heading" className="rounded-lg border bg-white p-5 shadow-sm sm:p-6">
        <h3 id="appearance-heading" className="font-semibold text-gray-900">Appearance</h3>
        <p id="appearance-help" className="mt-1 text-sm text-gray-500">Applies immediately and is remembered in this browser. System follows your device settings.</p>
        <fieldset aria-describedby="appearance-help" className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <legend className="sr-only">Color theme</legend>
          {([{ value: 'light', label: 'Light', Icon: Sun }, { value: 'dark', label: 'Dark', Icon: Moon }, { value: 'system', label: 'System', Icon: Laptop }] as const).map(({ value, label, Icon }) => (
            <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${theme === value ? 'border-[#BF5700] bg-gray-50' : 'border-gray-300 hover:bg-gray-50'}`}>
              <input type="radio" name="appearance" value={value} checked={theme === value} onChange={() => changeTheme(value)} className="accent-[#BF5700]" />
              <Icon className="h-5 w-5 text-gray-500" aria-hidden="true" />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </fieldset>
        <p role="status" className="mt-3 text-sm text-gray-500">{themeMessage}</p>
      </section>

      <section aria-labelledby="password-heading" className="rounded-lg border bg-white p-5 shadow-sm sm:p-6">
        <h3 id="password-heading" className="font-semibold text-gray-900">Password</h3>
        <p id="password-help" className="mt-1 text-sm text-gray-500">Choose a new password with at least 8 characters.</p>
        <form onSubmit={savePassword} className="mt-4">
          <input type="hidden" name="username" autoComplete="username" value={account.email} />
          <fieldset disabled={savingPassword} className="space-y-4">
            <legend className="sr-only">Change password</legend>
            {([{ key: 'currentPassword', label: 'Current password' }, { key: 'newPassword', label: 'New password' }, { key: 'confirmPassword', label: 'Confirm new password' }] as const).map(({ key, label }) => (
              <div key={key}>
                <label htmlFor={`account-${key}`} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
                <input
                  id={`account-${key}`} name={key} type="password" required
                  autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
                  minLength={key === 'currentPassword' ? undefined : 8} maxLength={key === 'currentPassword' ? 1024 : 72}
                  aria-describedby={`password-help${passwordError ? ' password-error' : ''}`}
                  className={fieldClass} value={passwords[key]}
                  onChange={event => { setPasswords({ ...passwords, [key]: event.target.value }); setPasswordError(''); setPasswordSaved(false) }}
                />
              </div>
            ))}
            <button type="submit" disabled={savingPassword || !passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword} className={buttonClass}>
              {savingPassword ? 'Changing password…' : 'Change password'}
            </button>
          </fieldset>
          {passwordError && <p id="password-error" role="alert" className="mt-3 text-sm text-red-600">{passwordError}</p>}
          <p role="status" className="mt-2 text-sm text-green-600">{passwordSaved ? 'Password changed.' : ''}</p>
        </form>
      </section>
    </div>
  )
}
