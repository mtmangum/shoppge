# PGE Instrumentation/Machine Shop

Next.js rewrite of the UT Austin PGE (Petroleum & Geosystems Engineering) Instrumentation/Machine
Shop job tracker, replacing the existing Drupal 7 site at `shop.pge.utexas.edu`.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Drizzle ORM** on PostgreSQL
- **NextAuth v5** (credentials provider; Shibboleth/SSO stubbed for phase 2)
- **TanStack Table** for the jobs list
- **Tailwind CSS**
- **S3/MinIO** for job attachments (via `@aws-sdk/client-s3`)
- **Nodemailer** for email notifications (admins/machinists BCC'd on new job submission)

## Status

| Feature | Status |
|---|---|
| Job detail page (view, status changes, machinist assignment, materials, notes, status history) | Done |
| File uploads to S3/MinIO (upload, presigned download, delete) | Done |
| Email notifications | Done |
| Admin dashboard (analytics, shop trend charts, user management) | Done |
| Self-service access requests (`/request-access` + admin approval queue) | Done |
| Global activity log (`/admin/activity`), filterable and sortable | Done |
| My Jobs / Assigned to Me views, job-number search | Done |
| Access control scoped to job owner/assignee; verified file-upload content | Done |
| Automated test suite (`npm test`, Node's built-in test runner) | Done |
| Password reset, invitation emails, 12-character password minimum | Done |
| Login throttling and security headers | Done |
| Shibboleth/SSO | Not started (planned for v2) |
| TLS | Not started (pending a domain name) |

## Getting started

### 1. Prerequisites

- Node.js 20+
- PostgreSQL 16
- An S3-compatible store (MinIO for local dev)

### 2. Configure environment

```
cp .env.example .env
```

Fill in `DATABASE_URL`, `S3_*` / `MINIO_*`, and `SMTP_*` values. `NEXTAUTH_SECRET` can be generated with:

```
openssl rand -base64 32
```

For local email testing without hitting the real UT SMTP relay, run [Mailpit](https://github.com/axllent/mailpit):

```
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
```

Then set `SMTP_HOST=localhost` and `SMTP_PORT=1025` in your `.env`. Open http://localhost:8025 to inspect captured emails.

### 3. Install dependencies and push the schema

```
npm install
npm run db:push
```

### 4. Run the dev server

```
npm run dev
```

The app expects a `job_stats_view` SQL view (used by the open-jobs dashboard). To sign in you
need a user: run `npm run db:seed` for a set of dummy accounts, or create a real first admin
with `npm run db:create-admin` (see [Accounts and passwords](#accounts-and-passwords)).

### Other scripts

```
npm run typecheck        # tsc --noEmit
npm run lint             # next lint
npm test                 # node --test tests/*.test.cjs
npm run build            # production build
npm run db:studio        # Drizzle Studio
npm run db:seed          # populate a fresh DB with realistic dev data (scripts/seed-dummy-data.ts)
npm run db:create-admin   # create the first admin from ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD
npm run migrate:from-drupal   # one-time Drupal 7 MySQL -> Postgres migration (see script header)
```

`npm run db:seed` also creates one obvious login per role for manual testing:
`requestor@utexas.edu` / `machinist@utexas.edu` / `admin@utexas.edu`, all with password `password123`.

## Accounts and passwords

Sign-in is by email and password (UT Shibboleth SSO is planned for v2). `schema.sql` creates no
users, so the first admin has to be created explicitly:

```
ADMIN_EMAIL=you@utexas.edu ADMIN_NAME="Your Name" ADMIN_PASSWORD='at-least-12-chars' npm run db:create-admin
```

On a Docker host use `docker compose --profile tools run --build --rm create-admin` with the same
variables set (see [One-time host setup](#one-time-host-setup)). The script refuses to touch an
account that already exists.

**How people get accounts**
1. Someone submits `/request-access`. The form answers the same whether or not the email already
   has an account or a pending request, so it can't be used to discover accounts.
2. An admin approves it in the admin panel (Users). Leave the password blank: the person is
   emailed a link, valid for 7 days, to choose their own. They can only sign in once they have
   used it, which also confirms they own the address. Typing a password instead skips the email.
   Creating a user directly in the admin panel works the same way.

**Forgotten passwords.** `/forgot-password` emails a reset link, valid for 1 hour. Links work once,
a newer link voids older ones, and only a SHA-256 of the token is stored (`password_reset_tokens`).
The page gives the same answer for unknown addresses. Requests are limited to 3 per email and 10
per IP per hour. Both flows need working `SMTP_*` settings. Setting a password through a link also
lifts any sign-in lockout on that account. Existing signed-in sessions are not ended (see below).

**Password rules.** At least 12 characters and at most 72 bytes (bcrypt ignores anything longer).
This applies to password changes, admin-set passwords and reset links. Older, shorter passwords
keep working until they are changed.

**Sign-in throttling.** 5 failed attempts per email and 30 per IP within 15 minutes are blocked
(15-minute window, same generic "invalid email or password" message). Wrong-email and
wrong-password attempts take the same time. Limits are held in memory, so they reset when the app
restarts and are per container. Anyone can also lock a real user out for 15 minutes by guessing
their address; a password reset clears that. Move the counters to the database or Redis before
running more than one app container.

**Known gaps.** There is no Content-Security-Policy yet, sessions are 8-hour JWTs that a password
reset does not revoke (deactivating a user does take effect immediately), and there is no MFA.
See `docs/SECURITY-REVIEW.md`.

## Docker

`docker-compose.yml` brings up the app alongside Postgres, MinIO, and an nginx reverse proxy —
see that file for the full service layout and required env vars.

## Deploying to AWS

For the separate, on-demand test environment, see [docs/AWS-TEST.md](docs/AWS-TEST.md).

The old dev deployment (an EC2 host in AWS account `645684341804` running `docker-compose.yml`,
with the host itself registered as the Actions runner) has been retired, and its `pge-shop-dev`
resources were deleted in October 2026. The only live deployment is the on-demand test
environment in the UT Austin AWS account `777439247518`, described in
[docs/AWS-TEST.md](docs/AWS-TEST.md). It holds dummy data only.

This GHE instance is self-hosted (GitHub Enterprise Server) and doesn't provide GitHub-hosted
runners, so the test instance is registered as a self-hosted Actions runner (`pge-shop-test`, a
systemd service under `/home/ubuntu/actions-runner`). `.github/workflows/ci-cd.yml` runs
typecheck/lint/test/build on every push and PR to `main` on that runner, and on push to `main`
(after those pass) the `deploy` job syncs the checkout into `/home/ubuntu/pge-shop-test`, keeps the
server's own `.env`, and runs `docker compose -f docker-compose.test.yml up -d --build`. No SSH
secrets are needed. The instance is stopped between uses, so jobs wait in the queue until it is
started. Database migrations in `migrations/` are **not** applied by the deploy job; see
[Upgrading an existing database](#upgrading-an-existing-database).

`docker-compose.yml` (app + Postgres + MinIO for attachment storage + nginx on `:80`/`:443`) is kept
as the template for a future production host, which does not exist yet; the steps below describe
preparing one, and CI does not deploy to it. `docker-compose.aws.yml` is a lighter variant (app +
Postgres, real S3, app exposed straight on `:80`) that nothing uses today; don't combine it with the
nginx/storage containers, since their `ports` mappings collide.

### One-time host setup

1. EC2 instance with Docker and the Docker Compose plugin installed, security group allowing
   inbound `:80`/`:443` (and `:22` for your own SSH access).
2. Copy the repo onto the box (`rsync` from a local checkout, or `scp`/manual upload — the box
   does not need to be a git clone; only the built Docker image and `docker-compose.yml` are
   required at runtime). Also needs `nginx.conf` and a `./certs` directory (can be empty pending
   TLS — see the Security section below).
3. Create a `.env` file in the app directory on the host (not committed) with production values:
   - `NEXTAUTH_URL` — the public URL/IP of the deployment
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `DB_PASSWORD` — a strong password for the `db` service
   - `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` — credentials for the bundled MinIO container,
     which is what actually stores attachments on this box (`docker-compose.yml` sets
     `S3_ENDPOINT` internally to point the app at it — real AWS S3 is only used by the
     `docker-compose.aws.yml` alternative, which this box does not run; see above).
4. Bring the stack up:
   ```
   docker compose -f docker-compose.yml up -d --build
   ```
   `schema.sql` is mounted into the `db` service's init directory, so the schema is created
   automatically on first boot. It seeds no users.
5. Create the first admin (12+ character password; run once, from the app directory):
   ```
   ADMIN_EMAIL=you@utexas.edu ADMIN_NAME="Your Name" ADMIN_PASSWORD='...' \
     docker compose --profile tools run --build --rm create-admin
   ```
   Databases created before this change still contain the old default
   `admin@pge.utexas.edu` account with the password `changeme`. On any such
   database, sign in and change that password, or deactivate the account.

Failed sign-ins are throttled in memory (5 per email and 30 per IP per 15 minutes), so the
limit resets when the app restarts and applies per container.

### Upgrading an existing database

`schema.sql` only runs when the database is first created. After pulling a release that adds
files to `migrations/`, apply them once, in order (each is safe to run twice):

```
docker compose -f docker-compose.yml exec -T db psql -U pgeshop -d pge_shop < migrations/001-password-reset-tokens.sql
```

Do this before deploying the release that needs them. Databases created before the default admin
was removed still contain `admin@pge.utexas.edu` with the password `changeme`: change it or
deactivate the account.

### Deploying an update manually

From a local checkout of the repo:

```
rsync -az --delete --exclude '.git' --exclude 'node_modules' --exclude '.next' --exclude '.env' \
  ./ <user>@<host>:<path-to-app-dir>/
ssh <user>@<host> "cd <path-to-app-dir> && docker compose -f docker-compose.yml up -d --build"
```

`.env` is excluded deliberately — it holds real production secrets that only ever live on the
host, and `--delete` would otherwise remove it (since it's gitignored and never present in a
fresh checkout).

This rebuilds the `app` image and restarts it; the `db` container and its volume are left alone,
so existing data persists.

### Rolling back

```
git checkout <previous-tag-or-commit>
docker compose -f docker-compose.yml up -d --build
```

## Security

See `docs/SECURITY-REVIEW.md` for the full review and its status updates. One item remains open
and is worth knowing about before a real production launch:
- **TLS**: not yet configured (`nginx.conf` currently serves plain `:80`; `./certs` is an empty
  mount point). Blocked on getting a domain name for this deployment — once there's one, this is
  the next thing to set up.

Login throttling, password reset, the 12-character minimum, the removal of the default admin and
the security headers are described under [Accounts and passwords](#accounts-and-passwords).

Everything else the review flagged (job/attachment access scoped to owner or assigned staff,
upload content-type verification, forced-download `Content-Disposition`) is fixed as of
`0.2.0-beta.3` — see the CHANGELOG.

## Project layout

```
app/
  jobs/              job list, new-job form, job detail page
  api/jobs/          job CRUD, status updates, attachments
  admin/             admin dashboard, user management, activity log
  request-access/    self-service access request form
  forgot-password/   request a password reset email
  reset-password/    set a password from an emailed link
  api/password-reset/  request and confirm endpoints for the two pages above
components/          shared UI (tables, badges, charts, job detail panels)
lib/                 db client, Drizzle schema, auth config, S3 helpers, shared types,
                     login throttle, password policy and reset-token logic
migrations/          SQL to apply to existing databases (schema.sql covers fresh ones)
scripts/             one-off/maintenance scripts (Drupal migration, dev data seed, create-admin, etc.)
tests/               node --test suite (API routes, filter component)
docs/                UI/UX and security review docs
```
