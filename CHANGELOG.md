# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are in `YYYY-MM-DD`.

## [Unreleased]

### Fixed
- Session data (name, role) was baked into the JWT at login and never
  refreshed, so an admin editing a user's name, changing their role, or
  deactivating their account had no effect on that user's *existing* session
  until it naturally expired (up to the 8h `maxAge`) — deactivation in
  particular meant a revoked account kept full access for up to 8 hours.
  The `jwt` callback in `lib/auth.ts` now re-reads name/role/`isActive` from
  the DB on every request (not just at sign-in); if the account is no longer
  active, the token is invalidated and the `session` callback returns no
  `user`, so `requireAuth()` correctly rejects it and the next request
  redirects to `/login`. Verified both effects directly: an existing
  session picks up a name change without re-logging in, and a deactivated
  user's existing session is redirected to `/login` on its very next request.
- Mobile layout: the whole site was horizontally scrollable on phone-width
  screens. Root causes were the header (title + UT logo) and Navbar (5 links +
  user info) not wrapping, and every data table lacking its own scroll
  container — so a wide table forced the entire page wider than the viewport,
  dragging unrelated content (stat cards, sign-in form, even the Sign Out
  button) off-screen with it. Fixed by wrapping every table in its own
  `overflow-x-auto` container, letting the header/Navbar wrap (Navbar's user
  info now drops to its own line if the nav links don't leave room), and a
  defensive `overflow-x-hidden` on the page root as a backstop. Verified with
  Puppeteer at a true 375px viewport (the raw headless Chrome CLI screenshots
  used earlier were silently rendering at a wider forced viewport, which is
  why this needed a proper tool to actually confirm).
- Less-critical table columns now hide below the `md` breakpoint instead of
  contributing to overflow: Users (email, department), Jobs (entry date, date
  required, requestor, machinist), homepage recent-jobs (entry date), and
  Activity Log (note) — all still reachable by scrolling the table
  horizontally, nothing is removed, just deprioritized on narrow screens.

### Added
- Global activity log at `/admin/activity`: paginated (50/page), filterable by
  job #, changed-by user, new status, and date range, all via `searchParams` on
  a plain `GET` form (no client JS). Linked from the Navbar and from the
  dashboard's "Recent Activity" card ("View full log →"), which stays as the
  last-20 snapshot.
- Edit action on `/admin/users`: a pencil icon per row expands an inline form
  for name, email, department, phone, and room (role/status/password already
  had their own controls). `PATCH /api/users/[id]` gained `email` to its
  editable fields to support it.
- Delete action on `/admin/users`: `DELETE /api/users/[id]`, gated by
  `requireAdmin()`. Since `jobs.requestor_id` (and machinist/completed-by/
  attachment-uploader/status-history-actor) all reference `users.id` without
  cascade, a user with any of those is refused with a count-by-category
  message ("linked to N job(s), N attachment(s), N status-history entries —
  deactivate instead") rather than surfacing a raw FK violation. Only
  never-used accounts can actually be hard-deleted; an admin can't delete
  their own account.
- Landing page at `/` for unauthenticated visitors, with a compact sign-in bar and a
  public preview of the 10 most recent jobs (job #, description, status, priority,
  days in queue — no requestor/machinist names, to limit exposure to non-identifying
  fields).
- Root route now redirects signed-in users straight to `/jobs`.
- Admin-only job deletion: `DELETE /api/jobs/[id]`, gated by `requireAdmin()`, removes
  the job's S3/MinIO attachment objects before deleting the row (item/attachment/
  status-history rows cascade at the DB level). Exposed as a "Danger Zone" section in
  `JobActions`, visible only to the `admin` role, with a confirmation prompt.
- `schema.sql` restored to the repo (was referenced by `docker-compose.yml` but
  missing) — includes the canonical `job_stats_view` / `open_jobs_view` definitions
  and the `set_updated_at` trigger.
- Admin dashboard at `/admin`: shop-wide stats, per-machinist workload (open/urgent/
  completed counts), an overdue-or-urgent jobs list (priority = urgent or > 14 days
  in queue), and a cross-job recent-activity feed sourced from `job_status_history`.
- User management at `/admin/users`: create users, change role, activate/deactivate
  (deactivated users are blocked at login), and set/reset a user's password —
  notably this is how the users imported from the live Drupal site (whose password
  hashes couldn't be migrated) can be given a working login. `POST /api/users` and
  `PATCH /api/users/[id]`, both `requireAdmin()`-gated; an admin can't deactivate or
  demote their own account.
- Shop trends on `/admin`: two hand-rolled SVG charts (no charting library) —
  jobs completed per week and average turnaround time per week, both over a
  trailing 12-week window generated with `generate_series` so weeks with zero
  completions still show as zero rather than being skipped. Single-hue
  (brand orange), hover tooltips + crosshair on the line chart, and a direct
  value label on the peak bar / line endpoint so every value is reachable
  without hovering.

### Fixed
- The "Attach Drawing" file input on the new-job form (`app/jobs/new/page.tsx`) was
  never wired up — selecting a file did nothing on submit. It now uploads the file
  to the newly created job immediately after submission, using the same endpoint the
  (working) job-detail attachments panel already used.

### Changed
- Homepage copy condensed from a full hero into a compact sign-in bar to make room
  for the recent-jobs preview.
- Homepage sign-in card now has an inline email/password form in place of the
  "Sign In" link, so visitors can log in without navigating to `/login` first.

## [0.1.0] - 2026-07-22
- Initial Next.js rewrite of the PGE Instrumentation/Machine Shop job tracker
  (Drupal 7 replacement).
- README covering stack, feature status, and local setup.
