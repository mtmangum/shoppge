# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Dates are in `YYYY-MM-DD`.

## [Unreleased]

### Changed
- Removed dead scaffold types from `lib/types.ts` (13 hand-written interfaces
  superseded long ago by Drizzle-inferred types and the Zod schemas that are
  actually used for validation) and an unused `DB` type alias from
  `lib/db.ts`. Removed five unused npm dependencies (`tailwind-merge`,
  `@radix-ui/react-dialog`/`react-select`/`react-label`/`react-tabs`) and the
  empty `app/api/reports/` directory.
- Reorganized `components/` into topical subfolders: `shared/` (badges used
  across routes), `jobs/` (jobs list/detail workflow), `admin/users/`,
  `admin/charts/`, `auth/`. No behavior change. `Navbar.tsx` and the
  in-progress `AccountSettings.tsx` are deliberately left in place pending
  other work landing.
- Extracted `components/ui/Pill.tsx` (shared rounded-pill shell for
  `StatusBadge`/`PriorityBadge`/`QueueAgeBadge`, each keeping its own
  color/label logic) and `components/shared/Pagination.tsx` (shared
  Prev/Next pager).
- Extracted `lib/ui-classes.ts` (shared form-field styling for the jobs
  filter bar, activity log filters, and the create-user form — the three
  places that share the same "label above a single-line field, items-end
  row" layout) and `lib/query-helpers.ts` (shared days-in-queue/days-overdue
  SQL fragments and sort-key/direction resolution). Consolidated the
  requestor-job-ownership check (job detail page, attachment upload,
  attachment download) into a single `lib/auth.ts` helper,
  `isJobOwnerOrElevated` — no change in who can access what; added test
  coverage for the case (a requestor viewing/uploading to a job that isn't
  theirs) that wasn't previously exercised.

### Fixed
- Activity log pagination: disabled Prev/Next (page 1's Previous, the last
  page's Next) rendered as a `<Link>` with `opacity-40 pointer-events-none`,
  which stays keyboard-focusable and gets announced as an active link by
  screen readers despite looking disabled. Now uses the same inert-`<span>`
  pattern already used by the Jobs table's pagination, via the new shared
  `Pagination` component both now render through.

## [0.2.0-beta.3] - 2026-09-12

### Added
- My Jobs / Assigned to Me views: requestors get a "My Jobs" nav link (their
  own submitted jobs), machinists/admins get "Assigned to Me". Implemented
  as `?mine=1`/`?assigned=1` on the existing `/jobs` route, threaded through
  search/sort/pagination so the view persists across those interactions.
- Job-number search: the jobs search box now also matches by job id (a bare
  or `#`-prefixed number), not just description text.
- Automatic, debounced job filtering on `/jobs` — filters apply as you type
  instead of requiring an explicit submit.
- Queue-age badges and refined sorting on jobs and the activity log
  (sortable by days-in-queue/days-overdue, not just by date), plus general
  dashboard card refinements.
- Overdue now means "past `date_required`," not "queue age over 14 days" —
  a job entered 20 days ago but not due for another month isn't overdue.
  The dashboard's "Overdue / Urgent Jobs" list shows distinct "Xd overdue"
  (red) vs "Xd in queue" (neutral, urgent-but-not-yet-due) and sorts
  most-overdue first.
- Job description now shown next to the actor in the dashboard's Recent
  Activity feed, truncated to one line.
- The whole row is now clickable (not just the "#id" cell) on the Jobs
  table, Activity Log, and the dashboard's Recent Activity and
  Overdue/Urgent Jobs lists, matching the existing Needs Assignment
  pattern. Keyboard nav and middle-click/new-tab on the "#id" link still
  work as before.
- `scripts/seed-dummy-data.ts` (`npm run db:seed`) expanded significantly:
  30 templated jobs across a realistic status distribution, backdated
  entry dates, a lighter historical segment back to June so the dashboard's
  12-week trend charts have data in every bucket, tightened counts so only
  a handful of jobs show as overdue, and one obvious test login per role
  (`requestor@utexas.edu` / `machinist@utexas.edu` / `admin@utexas.edu`,
  password `password123`).
- Automated test suite (Node's built-in test runner, `npm test`) covering
  job-action API routes and status integrity, wired into CI between lint
  and build.
- `docs/UI-UX-PERFORMANCE-REVIEW.md` and `docs/SECURITY-REVIEW.md`: written
  reviews of the app's UI/UX/accessibility and security posture, most of
  whose findings are addressed by the fixes in this release (remaining
  open items — TLS pending a domain name, login rate limiting — are noted
  in the security doc).

### Security
- Job detail page and attachment upload/download are now restricted to the
  job's own requestor (or any machinist/admin) instead of being reachable
  by any authenticated user who knows/guesses a job ID — closes exposure
  of billing/sponsor account numbers and arbitrary attachment access.
- Uploaded attachments are now verified against actual file content (magic
  bytes for PDF/PNG/JPEG via new `lib/file-type.ts`) instead of trusting
  the client-supplied MIME type, and downloads always force
  `Content-Disposition: attachment` regardless of stored type.

### Changed
- Shop Trends tooltips (dashboard charts): bigger box/text, theme-aware
  colors (invert light/dark so they always read as a floating overlay
  instead of blending into a dark surface), positioned above the hovered
  bar/point and shifted sideways instead of covering it when there's no
  room above, and animated into position on move. The position animation
  now uses an inline `style.transform` rather than the SVG `transform`
  attribute, since Safari doesn't reliably transition the latter.
- Native `<select>`/date/number field styling normalized (jobs filter bar,
  activity log filters, access request role picker, job actions, users
  page) so they render consistently with text inputs instead of picking up
  inconsistent native OS chrome.
- `/jobs` summary cards (Pending, In Progress, Urgent Open) are now real
  links to the filtered view instead of hover-only highlighting, so
  they're reachable by keyboard and usable on touch.
- Mobile layout: the jobs list becomes tappable cards below `md` instead of
  a table with hidden columns (due date/priority/assignee are now always
  visible); the new-job form's line-item row stacks to one field per line
  on narrow screens.
- CI/CD deploy now targets `docker-compose.yml`, the compose file actually
  running on the box, instead of the stale `docker-compose.aws.yml` (whose
  port mapping collides with nginx and was leaving the app container dead).
- Dev and production build output are now separated (`.next-dev` vs
  `.next`), so running `next dev` alongside `next build`/CI no longer
  corrupts a shared build directory.

### Fixed
- Open Jobs filter: selecting "Completed" returned nothing (the base query
  always ANDed `status != 'completed'`), and Cancelled jobs leaked into the
  default Open view. An explicit status filter now replaces the default
  condition instead of ANDing with it.
- Calendar dates (entry date, date required, date completed) rendered one
  day early in negative-UTC timezones (e.g. `America/Chicago`) — switched
  from `new Date(dateOnlyString)` to date-fns `parseISO`.
- Days in Queue undercounted by one for jobs spanning a DST transition —
  switched to date-fns `differenceInCalendarDays`, which isn't affected by
  real elapsed time.
- Duplicate job creation when retrying a failed attachment upload after
  the job itself had already been created; a retry now reuses the existing
  job id and locks the rest of the form.
- Optimistic UI updates for materials checkboxes and machinist assignment
  no longer silently look successful on a failed save — both now roll back
  to the prior value and surface an error.
- Crash (`500`) on a job-number search value out of Postgres `int4` range;
  now capped before being passed to the query.
- Two rounds of accessibility fixes: form labels not associated with their
  inputs, icon-only buttons with no accessible name, disabled pagination
  links still focusable/activatable via keyboard, contrast failures found
  by an axe-core audit, and validation/action-result errors not announced
  to screen readers (missing `aria-describedby`/`aria-invalid`/`role="alert"`).
- `nginx.conf` (required by `docker-compose.yml`) was missing from the
  repo, breaking the nginx sidecar on a fresh clone; restored.
- `package-lock.json`'s embedded version had drifted from `package.json`.

## [0.2.0-beta.2] - 2026-07-24

### Added
- **Email notifications on new job submission** (`lib/mail.ts`): when a
  requestor submits a new job via `POST /api/jobs`, all active `admin` and
  `machinist` users are BCC'd on a single email containing the job number,
  description, priority, date needed, requestor name, and a direct link to the
  job detail page. Uses the existing `SMTP_*` env vars (already documented in
  `.env.example`). Fire-and-forget — a failed send is logged to the console but
  never blocks the 201 response back to the requestor.
  `.env.example` updated with local dev testing instructions using
  [Mailpit](https://github.com/axllent/mailpit) (`docker run … axllent/mailpit`).
- README: documented the manual AWS deploy process (one-time EC2/Docker Compose
  host setup, deploying an update, rolling back) using the existing
  `docker-compose.aws.yml`.
- `.github/workflows/ci-cd.yml`: GitHub Actions workflow. `test` job runs
  typecheck/lint/build on every push/PR to `main`. `deploy` job runs after
  `test` passes on push to `main`. Both run on a self-hosted runner registered
  on the EC2 deploy box itself (`pge-shop-ec2`), since this GHE instance is a
  self-hosted Enterprise Server without GitHub-hosted runners available.
  Because the runner *is* the deploy target, `deploy` just checks out the repo,
  copies the persistent `/home/ubuntu/pge-shop/.env` into its workspace
  (never present in a fresh checkout — it's gitignored), and runs
  `docker compose -f docker-compose.aws.yml up -d --build` locally — no SSH
  secrets required.
- `.eslintrc.json` (`next/core-web-vitals`): `next lint` had no committed config,
  so it dropped into an interactive setup wizard and had apparently never
  completed non-interactively before. Needed for `npm run lint` to work in CI.

### Fixed
- Unescaped `"`/`'` in JSX text (`app/admin/page.tsx`, `app/request-access/page.tsx`)
  — real `react/no-unescaped-entities` errors that `next lint` had never actually
  caught before now that it runs to completion.

### Changed
- Header: UT logo now hidden on mobile (`< 640px`) to reduce clutter on small
  screens; visible on `sm` breakpoint and up.
- Footer: updated to meet UT standard footer requirements. Replaced ad-hoc
  links with the four required links (Emergency Information, Site Policies,
  Web Accessibility Policy, Web Privacy Policy) per UMAC website guidelines.
  Cockrell School and PGE department links retained above the required links.
- Open Jobs page (`/jobs`) now paginates, sorts, and filters server-side
  instead of loading every open job into the page and faking pagination in
  the browser. The query, sort, and status/priority filters live in the URL
  (`?search=&status=&priority=&sort=&dir=&page=`) and are applied as SQL
  `WHERE`/`ORDER BY`/`LIMIT`/`OFFSET`, so page-load cost no longer scales
  with the total number of open jobs ever created. `JobsTable` dropped
  `@tanstack/react-table`'s in-memory sort/filter/pagination row models
  (no longer needed) in favor of plain links that update the URL.
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

### Added
- `docker-compose.aws.yml`: the AWS deployment's compose override, committed
  to the repo instead of living only on the EC2 box — no S3/nginx sidecars,
  app exposed directly on `:80`, real S3 via IAM creds.

### Fixed
- `lib/s3.ts` read `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` for its S3 client
  credentials even against real AWS S3 (no MinIO involved on that
  deployment), and always set `forcePathStyle: true`, which MinIO needs but
  real AWS S3 doesn't. Renamed the app-facing credential vars to
  `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (kept separate from MinIO's own
  `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, which now only name the MinIO
  container's superuser creds) and made `forcePathStyle` conditional on
  `S3_ENDPOINT` being set.
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
