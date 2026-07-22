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
| Admin dashboard | Not started |

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
