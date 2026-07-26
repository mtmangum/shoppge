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
- **Nodemailer** for email notifications (not yet wired up)

## Status

| Feature | Status |
|---|---|
| Job detail page (view, status changes, machinist assignment, materials, notes, status history) | Done |
| File uploads to S3/MinIO (upload, presigned download, delete) | Done |
| Email notifications | Not started |
| Admin dashboard (analytics, user management) | Done |
| Self-service access requests (`/request-access` + admin approval queue) | Done |

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
npm run build            # production build
npm run db:studio        # Drizzle Studio
npm run migrate:from-drupal   # one-time Drupal 7 MySQL -> Postgres migration (see script header)
```

## Docker

`docker-compose.yml` brings up the app alongside Postgres, MinIO, and an nginx reverse proxy —
see that file for the full service layout and required env vars.

## Deploying to AWS

Current deployment is a single EC2 instance running `docker-compose.aws.yml` (app + Postgres,
talking to real S3 directly — no MinIO/nginx sidecars, app exposed on `:80`).

This GHE instance is self-hosted (GitHub Enterprise Server) and doesn't provide GitHub-hosted
runners, so the EC2 box itself is registered as a self-hosted Actions runner (systemd service
`actions.runner._services.pge-shop-ec2`, installed under `~/actions-runner` for the `ubuntu`
user). `.github/workflows/ci-cd.yml` runs typecheck/lint/build on every push and PR to `main`
on that runner, and on push to `main` (after those checks pass) deploys automatically: since the
runner *is* the deploy target, the `deploy` job just checks out the repo into its own workspace,
copies the persistent production `.env` in from `/home/ubuntu/pge-shop/.env` (the checkout itself
never contains `.env` — it's gitignored), and runs `docker compose -f docker-compose.aws.yml up
-d --build` directly. No SSH secrets are needed for this — there's nothing to add in GHE's
Secrets settings for deploy to work.

Trade-off worth knowing: this box is small (2 vCPU, ~1.9GB RAM) and now runs CI builds *and* the
production containers side by side. Watch for memory pressure during builds; adding swap or
moving to a dedicated (self-hosted or hosted) runner are the escape hatches if it becomes a
problem.

Manual deploys still work the same way, from your own machine, if you'd rather not wait for CI:

### One-time host setup

1. EC2 instance with Docker and the Docker Compose plugin installed, security group allowing
   inbound `:80` (and `:22` for your own SSH access).
2. Copy the repo onto the box (`rsync` from a local checkout, or `scp`/manual upload — the box
   does not need to be a git clone; only the built Docker image and `docker-compose.aws.yml` are
   required at runtime).
3. Create a `.env` file in the app directory on the host (not committed) with production values:
   - `NEXTAUTH_URL` — the public URL/IP of the deployment
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `DB_PASSWORD` — a strong password for the `db` service
   - `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` — real AWS IAM
     credentials scoped to the attachments bucket. Leave `S3_ENDPOINT` **unset** so `lib/s3.ts`
     talks to real S3 instead of path-style MinIO.
4. Bring the stack up:
   ```
   docker compose -f docker-compose.aws.yml up -d --build
   ```
   `schema.sql` is mounted into the `db` service's init directory, so the schema (and seed admin
   user — change its password immediately) is created automatically on first boot.

### Deploying an update manually

From a local checkout of the repo:

```
rsync -az --delete --exclude '.git' --exclude 'node_modules' --exclude '.next' --exclude '.env' \
  ./ <user>@<host>:<path-to-app-dir>/
ssh <user>@<host> "cd <path-to-app-dir> && docker compose -f docker-compose.aws.yml up -d --build"
```

`.env` is excluded deliberately — it holds real production secrets that only ever live on the
host, and `--delete` would otherwise remove it (since it's gitignored and never present in a
fresh checkout).

This rebuilds the `app` image and restarts it; the `db` container and its volume are left alone,
so existing data persists.

### Rolling back

```
git checkout <previous-tag-or-commit>
docker compose -f docker-compose.aws.yml up -d --build
```

## Project layout

```
app/
  jobs/              job list, new-job form, job detail page
  api/jobs/          job CRUD, status updates, attachments
  admin/             admin dashboard (not yet implemented)
components/          shared UI (tables, badges, job detail panels)
lib/                 db client, Drizzle schema, auth config, S3 helpers, shared types
scripts/             one-off/maintenance scripts (Drupal migration, etc.)
```
