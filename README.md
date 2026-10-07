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
| Shibboleth/SSO | Not started (phase 2) |
| TLS | Not started (pending a domain name) |
| Login rate limiting | Not started |

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

The app expects a `job_stats_view` SQL view (used by the open-jobs dashboard) and a NextAuth
credentials-based user with a bcrypt `password_hash` to log in — seed one directly via
`npm run db:studio` or a one-off script.

### Other scripts

```
npm run typecheck        # tsc --noEmit
npm run lint             # next lint
npm test                 # node --test tests/*.test.cjs
npm run build            # production build
npm run db:studio        # Drizzle Studio
npm run db:seed          # populate a fresh DB with realistic dev data (scripts/seed-dummy-data.ts)
npm run migrate:from-drupal   # one-time Drupal 7 MySQL -> Postgres migration (see script header)
```

`npm run db:seed` also creates one obvious login per role for manual testing:
`requestor@utexas.edu` / `machinist@utexas.edu` / `admin@utexas.edu`, all with password `password123`.

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
   `schema.sql` is mounted into the `db` service's init directory, so the schema (and seed admin
   user — change its password immediately) is created automatically on first boot.

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

See `docs/SECURITY-REVIEW.md` for the full review. Two items remain open and are worth knowing
about before a real production launch:
- **TLS**: not yet configured (`nginx.conf` currently serves plain `:80`; `./certs` is an empty
  mount point). Blocked on getting a domain name for this deployment — once there's one, this is
  the next thing to set up.
- **Login rate limiting**: not implemented. The credentials login endpoint has no throttling
  against repeated attempts.

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
components/          shared UI (tables, badges, charts, job detail panels)
lib/                 db client, Drizzle schema, auth config, S3 helpers, shared types
scripts/             one-off/maintenance scripts (Drupal migration, dev data seed, etc.)
tests/               node --test suite (API routes, filter component)
docs/                UI/UX and security review docs
```
