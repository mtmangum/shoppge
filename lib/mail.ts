/**
 * Mailer — thin nodemailer wrapper using the SMTP env vars from .env.example.
 *
 * Exported surface:
 *   sendNewJobNotification(jobId, description, priority, dateRequired, requestorName)
 *
 * The transport is created lazily so a missing / misconfigured SMTP_HOST
 * doesn't blow up the entire app at startup — only the first send attempt
 * will throw, and callers are expected to catch + log rather than propagate.
 *
 * BCC strategy: one email with all admin/machinist addresses on BCC so
 * recipients don't see each other's addresses.
 */

import nodemailer from 'nodemailer'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { and, eq, inArray } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Transport (lazy singleton)
// ---------------------------------------------------------------------------

let _transport: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransport() {
  if (_transport) return _transport

  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const user = process.env.SMTP_USER || undefined
  const pass = process.env.SMTP_PASS || undefined

  if (!host) {
    throw new Error(
      'SMTP_HOST is not set — add it to your .env (see .env.example)'
    )
  }

  _transport = nodemailer.createTransport({
    host,
    port,
    // Port 587 uses STARTTLS; 465 uses implicit TLS.
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  return _transport
}

// ---------------------------------------------------------------------------
// Recipient query
// ---------------------------------------------------------------------------

async function getAdminAndMachinistEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(
      and(
        inArray(users.role, ['admin', 'machinist']),
        eq(users.isActive, true)
      )
    )

  return rows.map((r) => r.email).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface NewJobEmailParams {
  jobId: number
  description: string
  priority: string
  dateRequired: string | null
  requestorName: string
}

/**
 * Send a "new job submitted" notification to all active admins and machinists.
 *
 * Throws on transport / auth errors — callers should wrap in try/catch and
 * log the failure without blocking the 201 response to the requestor.
 */
export async function sendNewJobNotification(params: NewJobEmailParams) {
  const { jobId, description, priority, dateRequired, requestorName } = params

  const recipients = await getAdminAndMachinistEmails()
  if (recipients.length === 0) {
    // No staff accounts yet (e.g. fresh dev DB) — skip silently.
    return
  }

  const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const jobUrl = `${baseUrl}/jobs/${jobId}`

  const priorityLabel = priority === 'urgent' ? '🔴 URGENT' : 'Normal'
  const dateLabel = dateRequired ?? 'Not specified'

  const subject = `New job #${jobId}: ${description.slice(0, 60)}${description.length > 60 ? '…' : ''}`

  const text = [
    `A new job has been submitted in PGE ShopTrack.`,
    ``,
    `Job #${jobId}`,
    `Description : ${description}`,
    `Priority    : ${priorityLabel}`,
    `Date needed : ${dateLabel}`,
    `Submitted by: ${requestorName}`,
    ``,
    `View job: ${jobUrl}`,
  ].join('\n')

  const html = `
<p>A new job has been submitted in <strong>PGE ShopTrack</strong>.</p>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:14px;">
  <tr><td style="color:#666;padding-right:16px;">Job #</td><td><strong>${jobId}</strong></td></tr>
  <tr><td style="color:#666;">Description</td><td>${escapeHtml(description)}</td></tr>
  <tr><td style="color:#666;">Priority</td><td>${priorityLabel}</td></tr>
  <tr><td style="color:#666;">Date needed</td><td>${dateLabel}</td></tr>
  <tr><td style="color:#666;">Submitted by</td><td>${escapeHtml(requestorName)}</td></tr>
</table>
<p><a href="${jobUrl}" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#bf5700;color:#fff;text-decoration:none;border-radius:4px;">View Job #${jobId}</a></p>
`.trim()

  await getTransport().sendMail({
    from: process.env.SMTP_FROM ?? 'pge-shop@utexas.edu',
    to: process.env.SMTP_FROM ?? 'pge-shop@utexas.edu', // To: field = sender (avoids empty To:)
    bcc: recipients.join(', '),
    subject,
    text,
    html,
  })
}

export interface PasswordLinkEmailParams {
  to: string
  name: string
  token: string
  /** 'reset' = forgot-password; 'invite' = new account, set a first password. */
  kind: 'reset' | 'invite'
}

/**
 * Email a link to /reset-password. Throws on transport errors — callers decide
 * whether that is fatal. Never log the link: it is a credential.
 */
export async function sendPasswordLinkEmail({ to, name, token, kind }: PasswordLinkEmailParams) {
  const baseUrl = (process.env.NEXTAUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const url = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`
  const invite = kind === 'invite'
  const expires = invite ? '7 days' : '1 hour'

  const subject = invite ? 'Set your PGE ShopTrack password' : 'Reset your PGE ShopTrack password'
  const intro = invite
    ? 'An account has been created for you in PGE ShopTrack. Set a password to sign in:'
    : 'We received a request to reset your PGE ShopTrack password:'

  const text = [
    `Hello ${name},`,
    ``,
    intro,
    url,
    ``,
    `This link works once and expires in ${expires}.`,
    invite ? `` : `If you didn't ask for this, you can ignore this email; your password hasn't changed.`,
  ].join('\n')

  const html = `
<p>Hello ${escapeHtml(name)},</p>
<p>${intro}</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:8px 16px;background:#bf5700;color:#fff;text-decoration:none;border-radius:4px;">${invite ? 'Set password' : 'Reset password'}</a></p>
<p style="color:#666;font-size:13px;">This link works once and expires in ${expires}.${invite ? '' : " If you didn't ask for this, you can ignore this email; your password hasn't changed."}</p>
`.trim()

  await getTransport().sendMail({
    from: process.env.SMTP_FROM ?? 'pge-shop@utexas.edu',
    to,
    subject,
    text,
    html,
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
