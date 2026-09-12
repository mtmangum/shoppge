# Handoff notes

Things a future contributor (including future-you) would want to know that
aren't obvious from just reading the code. Update this file as these items
get resolved or new ones come up — it's meant to stay current, not be a
one-time snapshot.

## Landed since the last update

Account settings / theme system (light/dark mode), originally built by Matt
Mangum, landed in `0.2.0-beta.4`: `components/account/AccountSettings.tsx`,
`lib/account-settings.ts`, `app/settings/page.tsx`,
`app/api/account/route.ts`, `app/api/account/password/route.ts`, plus
`components/layout/Navbar.tsx` (the account-settings link) and the theme
cookie applied via `data-theme` in `app/layout.tsx`.

## Still-open security items

Full detail in `docs/SECURITY-REVIEW.md`. As of this writing:

- **TLS** (#1): not configured. `nginx.conf` serves plain `:80`; `./certs`
  is an empty mount point. Blocked on getting a domain name for this
  deployment — the review recommends Let's Encrypt/certbot directly on the
  box, or ACM if an ALB/CloudFront ever goes in front of it.
- **Login rate limiting** (#2): not implemented. No `middleware.ts`, no
  attempt counting anywhere in `lib/auth.ts`'s credentials provider.
- **Medium-severity infra items** (#5-8): a GHE personal access token was
  found embedded in the deploy host's `.git/config` (already failing auth,
  but rotate/remove it and stop needing that remote at all — the CI runner
  checks out into its own workspace and doesn't need it); the self-hosted
  CI runner executes on the same host that serves production, including on
  `pull_request`; the "Typecheck, lint, build" branch-protection check is
  being bypassed on every push (confirm that's an intentional tradeoff, not
  an oversight); the seed script's shared `password123` must never be
  pointed at a database holding real accounts.

Resolved this release (`0.2.0-beta.3`): job/attachment access scoped to
owner or assigned staff, upload content-type verification + forced
download disposition — see the CHANGELOG and the status notes in
`docs/SECURITY-REVIEW.md` itself.

## Next.js upgrade (14 → 15/16) is blocked, not just pending

There's no deliberate reason this app is still on Next.js 14 beyond "that's
what the initial scaffold used." The actual blocker: Next.js 15+ made
`params`, `searchParams`, `cookies()`, and `headers()` asynchronous
(`Promise`-based) in Server Components and Route Handlers. This codebase
uses all of those synchronously in many places — e.g.
`app/admin/activity/page.tsx`'s `{ searchParams }: { searchParams: SearchParams }`,
`app/jobs/[id]/page.tsx`'s `{ params }: { params: { id: string } }`, the
theme cookie read in `app/layout.tsx` — so upgrading is a real breaking-change
migration (every such destructure needs `await`), plus a React 19 bump, not
a version-number bump. Worth scoping as its own dedicated piece of work.

## The CHANGELOG pre-push hook can silently no-op

`.claude/hooks/check-changelog-before-push.sh`, wired via
`.claude/settings.json`'s `PreToolUse` matcher on `Bash(git push*)`, is
meant to block `git push` unless `CHANGELOG.md` is among the commits being
pushed. It's happened before (see commit `e70a192`) that this hook silently
allowed a push through because of a hardcoded path issue — since fixed, but
worth knowing the failure mode: the hook `exit 0`s (allows the push) if
`git rev-parse --abbrev-ref --symbolic-full-name @{u}` fails, e.g. no
upstream tracking branch is set. Don't treat "the push succeeded" as proof
the hook actually ran and checked anything — if you're not sure, check
`CHANGELOG.md` yourself before pushing.

## Where things live after the `0.2.0-beta.3`/`beta.4` refactor

`components/` is now organized into subfolders instead of one flat
directory: `shared/` (StatusBadge/PriorityBadge/QueueAgeBadge/Pagination —
used across multiple routes), `jobs/` (the jobs list/detail workflow),
`admin/users/`, `admin/charts/`, `auth/` (InlineLoginForm), `layout/`
(Navbar), `account/` (AccountSettings), and the pre-existing `ui/` (generic
non-domain primitives — Toaster, Pill).

New shared modules worth knowing about before adding a new duplicate of
something they already cover:
- `lib/dates.ts` — `formatDateOnly()`/`formatTimestamp()` for the two
  date-formatting patterns used throughout the app.
- `lib/query-helpers.ts` — `daysInQueueSql`/`daysOverdueSql` (reusable
  Drizzle `sql` fragments) and `resolveSortKey()`/`resolveSortDir()`/
  `sortOrderFn()` for the "validate a `?sort=`/`?dir=` search param"
  pattern used by both sortable-table pages.
- `lib/ui-classes.ts` — `FIELD_CLASS`/`LABEL_CLASS`/`SELECT_CHEVRON_CLASS`
  for the "label above a single-line field, items-end row" form pattern
  (jobs filter bar, activity log filters, create-user form). Deliberately
  **not** used by `components/jobs/JobActions.tsx`,
  `components/admin/users/UsersManager.tsx`, or `app/jobs/new/page.tsx` —
  those use a denser scale for their own narrower/inline context, or mix
  in textareas that a fixed field height would clip. Don't force those
  onto this module without re-checking the same layout concerns.
- `lib/auth.ts`'s `isJobOwnerOrElevated(user, job)` — the requestor-owns-
  this-job check, used by the job detail page and both attachment routes.
