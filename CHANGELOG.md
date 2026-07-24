# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are in `YYYY-MM-DD`.

## [Unreleased]

### Changed
- "ShopTrack" renamed to "UT ShopTrack" everywhere it appears in the UI.
- Footer: "Cockrell School of Engineering" and "Petroleum & Geosystems
  Engineering" are now links to cockrell.utexas.edu and pge.utexas.edu
  respectively. Added a copyright line with the current year, computed at
  render time (`new Date().getFullYear()`) rather than hardcoded, so it
  never goes stale. "The University of Texas at Austin" in that line links
  to utexas.edu.

## [0.2.0-beta.2] - 2026-07-24

### Changed
- Header: moved "Cockrell School of Engineering · Petroleum & Geosystems
  Engineering" out of the header (which was getting cluttered at 3 lines)
  and into the footer, above the existing department links. Added a simple
  gear icon to the left of "ShopTrack" in the header, in white to match the
  UT brand guidelines' two official primary colors (burnt orange + white)
  rather than introducing an accent color.
- Footer: replaced the "Faculty Innovation Center" link with "Faculty
  Technology Studio" (cockrell.utexas.edu/about/faculty/faculty-technology-studio/).
- Branded the web app as "ShopTrack" in the persistent header, browser tab
  title, login page, request-access page, and homepage sign-in card — the
  repo/package name and README stay as "pge-shop," this is UI-facing branding
  only. Added a one-line subheading under the header logo explaining what the
  site does ("Submit, track, and manage Instrumentation & Machine Shop work
  orders"), visible on every page.
- `JobsTable` pagination reduced from 25 to 10 rows per page, so pagination
  is actually exercised at realistic dev-data volumes instead of everything
  silently fitting on one page.
- Admin nav reordered to Dashboard, Open Jobs, Submit Job, Users, Activity —
  Dashboard first as the overview/landing view, Activity last since it's an
  occasional audit/lookup tool rather than a daily-use one.

### Fixed
- `Dockerfile`: `npm ci` → `npm ci --legacy-peer-deps`. The build wasn't actually
  reproducible — it happened to pass on some machines only because their local npm
  resolves the `next-auth`/`nodemailer` peer conflict more leniently than the npm
  bundled in the `node:20-alpine` base image.
- `tsconfig.json`: excluded `scripts/` from the TypeScript project. `next build`
  type-checks the whole project by default, and `scripts/migrate-from-drupal.ts`
  imports `mysql2/promise`, a package never added to `package.json` — this broke
  production builds.
- `docker-compose.yml`: the app service set `S3_ACCESS_KEY`/`S3_SECRET_KEY`, but
  `lib/s3.ts` reads `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` for credentials —
  silently broken S3 auth for anyone using the full Docker Compose stack. Also
  added `S3_REGION` passthrough and `AUTH_TRUST_HOST` (see below).
- `schema.sql`: the seed admin's bcrypt hash didn't actually correspond to the
  documented "changeme" password. Regenerated and verified.
- Documented `AUTH_TRUST_HOST` in `.env.example` — required by NextAuth v5 for
  any self-hosted deployment (not auto-detected outside a few known platforms);
  without it, every auth request fails with `UntrustedHost`.

## [0.2.0-beta.1] - 2026-07-23

### Added
- Job detail page (`/jobs/[id]`): view, status changes, machinist assignment,
  materials and notes, S3/MinIO-backed attachment upload/download/delete, and
  status history.
- Landing page at `/` for unauthenticated visitors, with a compact sign-in bar
  and a public preview of the 10 most recent jobs (job #, description, status,
  priority, days in queue — no requestor/machinist names, to limit exposure to
  non-identifying fields). Root route redirects signed-in users to `/jobs`.
- Admin dashboard at `/admin`: shop-wide stats, per-machinist workload
  (open/urgent/completed counts), an overdue-or-urgent jobs list (priority =
  urgent or > 14 days in queue), and a cross-job recent-activity feed sourced
  from `job_status_history`. Shop trends section adds two hand-rolled SVG
  charts (no charting library) — jobs completed per week and average
  turnaround time per week, over a trailing 12-week window generated with
  `generate_series` so weeks with zero completions show as zero rather than
  being skipped. Single-hue, hover tooltips + crosshair on the line chart, and
  a direct value label on the peak bar / line endpoint so every value is
  reachable without hovering.
- Hovering a stat card on `/jobs` (Pending, In Progress, Urgent Open)
  highlights the matching rows in the table below (tint + left border) in
  that card's own color — yellow/blue/red, echoing the existing status/
  priority badge colors. Avg. Completion doesn't highlight anything, since
  it's a historical metric with no matching rows in the open-jobs list.
- User management at `/admin/users`: create, edit (pencil icon expands a form
  for name/email/department/phone/room/password), change role, activate/
  deactivate (blocked at login), and delete (refused with a count-by-category
  message if the user has any jobs/attachments/status-history linked to them,
  since those reference `users.id` without cascade — only never-used accounts
  can be hard-deleted). Deactivating/editing a user takes effect on their
  *existing* session immediately rather than waiting out the 8h JWT `maxAge`.
  This is also how users imported from the live Drupal site (whose password
  hashes couldn't be migrated) get a working login.
- Self-service access requests: a public `/request-access` form (linked from
  `/login` and the homepage sign-in card) collects name, email, department,
  phone, and reason into a pending queue at the top of `/admin/users` —
  approve (choosing a role, optionally a password) creates the account,
  reject closes it out with nothing created.
- Global activity log at `/admin/activity`: paginated (50/page), filterable by
  job #, changed-by user, new status, and date range. Linked from the Navbar
  and from the dashboard's "Recent Activity" card, which stays as a last-20
  snapshot.
- Admin-only job deletion (`DELETE /api/jobs/[id]`), removing the job's S3/
  MinIO attachments before deleting the row, exposed as a "Danger Zone" in
  the job detail page.
- `schema.sql` restored to the repo (was referenced by `docker-compose.yml`
  but missing), including `job_stats_view`/`open_jobs_view` and the
  `set_updated_at` trigger.

### Fixed
- The "Attach Drawing" file input on the new-job form never actually
  uploaded anything on submit; it now does, via the same endpoint the
  job-detail attachments panel uses.
- Session data (name, role, active status) was baked into the JWT at login
  and never refreshed — see admin user-management note above.
- Mobile: the whole site was horizontally scrollable on phone-width screens.
  Root causes were the header/Navbar not wrapping and every data table
  lacking its own scroll container, so a wide table forced the entire page
  wider than the viewport. Fixed by wrapping every table in `overflow-x-auto`,
  letting the header/Navbar wrap, and a defensive `overflow-x-hidden` on the
  page root. Verified with Puppeteer at a true 375px viewport (raw headless
  Chrome CLI screenshots were silently rendering at a wider forced viewport).
  Less-critical columns (Users: email/department; Jobs: entry date, date
  required, requestor, machinist; homepage: entry date; Activity Log: note)
  now hide below the `md` breakpoint instead of contributing to overflow —
  still reachable by scrolling the table.

### Changed
- Homepage copy condensed from a full hero into a compact sign-in bar (inline
  email/password form) to make room for the recent-jobs preview.
- `/admin/users`: moved "+ New User" next to the "Users" heading, and folded
  password reset into the same edit form as name/email/department/phone/room
  instead of its own column/control.

## [0.1.0] - 2026-07-22
- Initial Next.js rewrite of the PGE Instrumentation/Machine Shop job tracker
  (Drupal 7 replacement).
- README covering stack, feature status, and local setup.
