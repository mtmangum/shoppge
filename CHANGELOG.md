# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are in `YYYY-MM-DD`.

## [Unreleased]

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
