-- PGE Instrumentation/Machine Shop
-- PostgreSQL 16 Schema
-- Run with: psql -U postgres -d pge_shop -f schema.sql

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE job_status AS ENUM (
  'pending',
  'inprogress',
  'completed',
  'cancelled'
);

CREATE TYPE job_priority AS ENUM (
  'normal',
  'urgent'
);

CREATE TYPE user_role AS ENUM (
  'requestor',
  'machinist',
  'admin'
);

CREATE TYPE access_request_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  role            user_role NOT NULL DEFAULT 'requestor',
  password_hash   TEXT,                        -- NULL for SSO-only users
  eid             VARCHAR(50),                 -- UT EID (Phase 2 Shibboleth)
  department      VARCHAR(100),
  phone           VARCHAR(30),
  room            VARCHAR(50),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_eid   ON users(eid) WHERE eid IS NOT NULL;

-- ============================================================
-- Access Requests (self-service "request an account" queue)
-- ============================================================
CREATE TABLE access_requests (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  department      VARCHAR(100),
  phone           VARCHAR(30),
  reason          TEXT,
  status          access_request_status NOT NULL DEFAULT 'pending',
  reviewed_by_id  INTEGER REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_requests_status ON access_requests(status);

-- ============================================================
-- Jobs
-- ============================================================
CREATE TABLE jobs (
  id                    SERIAL PRIMARY KEY,
  -- Preserved from Drupal (set sequence start to max+1 after migration)

  entry_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  date_required         DATE NOT NULL,
  description           TEXT NOT NULL,

  requestor_id          INTEGER NOT NULL REFERENCES users(id),
  machinist_id          INTEGER REFERENCES users(id),   -- assigned machinist

  status                job_status NOT NULL DEFAULT 'pending',
  priority              job_priority NOT NULL DEFAULT 'normal',

  -- Materials
  materials_required    BOOLEAN NOT NULL DEFAULT FALSE,
  materials_ordered     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Completion
  date_completed        DATE,
  completed_by_id       INTEGER REFERENCES users(id),

  -- Billing / Sponsor
  account_number        VARCHAR(50),
  account_title         VARCHAR(255),
  bookkeeper_name       VARCHAR(255),
  bookkeeper_address    TEXT,
  sponsor_org           VARCHAR(255),     -- Sponsoring Faculty/Organization
  sponsor_signature     VARCHAR(255),     -- Name-based for now

  -- Internal
  machinist_notes       TEXT,             -- Internal notes not shown to requestors

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_status       ON jobs(status);
CREATE INDEX idx_jobs_priority     ON jobs(priority);
CREATE INDEX idx_jobs_requestor    ON jobs(requestor_id);
CREATE INDEX idx_jobs_machinist    ON jobs(machinist_id);
CREATE INDEX idx_jobs_entry_date   ON jobs(entry_date DESC);
CREATE INDEX idx_jobs_date_req     ON jobs(date_required);

-- ============================================================
-- Job Items (line items per job)
-- ============================================================
CREATE TABLE job_items (
  id          SERIAL PRIMARY KEY,
  job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,           -- 1, 2, 3… (ordering)
  part_number VARCHAR(100),
  quantity    VARCHAR(50),                -- kept as text ("1", "2 each", etc.)
  description TEXT,

  UNIQUE (job_id, item_number)
);

CREATE INDEX idx_job_items_job ON job_items(job_id);

-- ============================================================
-- Job Attachments (PDF drawings)
-- ============================================================
CREATE TABLE job_attachments (
  id              SERIAL PRIMARY KEY,
  job_id          INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  original_name   VARCHAR(255) NOT NULL,    -- user-facing filename
  storage_key     VARCHAR(500) NOT NULL,    -- S3/MinIO object key
  file_size_bytes INTEGER,
  mime_type       VARCHAR(100) DEFAULT 'application/pdf',
  uploaded_by_id  INTEGER REFERENCES users(id),
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attachments_job ON job_attachments(job_id);

-- ============================================================
-- Job Status History (immutable audit log)
-- ============================================================
CREATE TABLE job_status_history (
  id            SERIAL PRIMARY KEY,
  job_id        INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  from_status   job_status,               -- NULL on first entry
  to_status     job_status NOT NULL,
  changed_by_id INTEGER REFERENCES users(id),
  note          TEXT,                     -- optional comment on the change
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_history_job ON job_status_history(job_id);

-- ============================================================
-- Auto-update updated_at via trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Auto-log status changes
--
-- NOTE: the app currently inserts job_status_history rows itself
-- (see app/api/jobs/route.ts and app/api/jobs/[id]/status/route.ts),
-- capturing changed_by_id and note. Do NOT also enable this trigger
-- in an environment running that app code — it will double-log every
-- status change (once from the app with full detail, once from here
-- with null changed_by_id/note). Kept here for reference / for use
-- against the raw schema without the app layer.
-- ============================================================
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO job_status_history (job_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Not enabled by default — see note above.
-- CREATE TRIGGER trg_job_status_history
--   AFTER UPDATE ON jobs
--   FOR EACH ROW EXECUTE FUNCTION log_job_status_change();

-- ============================================================
-- Seed: default admin user
-- Password is 'changeme' — CHANGE THIS IMMEDIATELY
-- bcrypt hash generated with 12 rounds
-- ============================================================
INSERT INTO users (email, name, role, password_hash)
VALUES (
  'admin@pge.utexas.edu',
  'Admin',
  'admin',
  '$2a$12$dPvz420HfGeT8cuH2G9VLuxU5JQvq0b9Rhs6YqS2h.bjVBLYWKYWS'
);

-- ============================================================
-- Useful views
-- ============================================================

-- Open jobs with days elapsed (mirrors current homepage)
CREATE OR REPLACE VIEW open_jobs_view AS
SELECT
  j.id,
  j.entry_date,
  j.date_required,
  j.description,
  j.status,
  j.priority,
  CURRENT_DATE - j.entry_date AS days_elapsed,
  r.name  AS requestor_name,
  m.name  AS machinist_name
FROM jobs j
JOIN users r ON r.id = j.requestor_id
LEFT JOIN users m ON m.id = j.machinist_id
WHERE j.status NOT IN ('completed', 'cancelled')
ORDER BY j.id DESC;

-- Dashboard summary stats
CREATE OR REPLACE VIEW job_stats_view AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending')                             AS pending_count,
  COUNT(*) FILTER (WHERE status = 'inprogress')                         AS inprogress_count,
  COUNT(*) FILTER (WHERE status = 'completed')                          AS completed_count,
  COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled')
                     AND priority = 'urgent')                            AS urgent_open_count,
  ROUND(AVG(date_completed - entry_date)
    FILTER (WHERE status = 'completed'))::INTEGER                        AS avg_completion_days
FROM jobs;
