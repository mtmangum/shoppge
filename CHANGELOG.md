# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are in `YYYY-MM-DD`.

## [Unreleased]

### Added
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

### Fixed
- The "Attach Drawing" file input on the new-job form (`app/jobs/new/page.tsx`) was
  never wired up — selecting a file did nothing on submit. It now uploads the file
  to the newly created job immediately after submission, using the same endpoint the
  (working) job-detail attachments panel already used.

### Changed
- Homepage copy condensed from a full hero into a compact sign-in bar to make room
  for the recent-jobs preview.
- Header now includes an inline sign-in form (email/password + submit) for
  unauthenticated visitors, so they can log in without navigating to `/login`
  first. Hidden once a session exists.

## [0.1.0] - 2026-07-22
- Initial Next.js rewrite of the PGE Instrumentation/Machine Shop job tracker
  (Drupal 7 replacement).
- README covering stack, feature status, and local setup.
