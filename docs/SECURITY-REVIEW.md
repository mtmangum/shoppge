# UT ShopTrack Security Review

Review date: September 12, 2026
Reviewed deployment: http://3.21.240.225/ (AWS dev box) and local source at the time of writing.

This is a source-level review plus live checks against the running dev deployment (curl/SSH), not a penetration test. No production data exists yet — this app has one dev deployment seeded with dummy data — so nothing here is an active incident, but several items should be resolved before this becomes a real production system handling real UT Austin account/billing data.

Findings are ordered by severity. Each includes what was checked, why it matters, and a concrete fix.

## High severity

### 1. No TLS — the entire site is plaintext HTTP

**Finding:** `nginx.conf` only has a `listen 80` server block; there is no `listen 443`, no certificate configuration, and the `./certs` mount in `docker-compose.yml` is unused. Confirmed live: `https://3.21.240.225/` doesn't connect at all (connection refused), while `http://3.21.240.225/` serves the full app.

**Why it matters:** Login credentials (the POST body to `/login`), the NextAuth session cookie, and every page of billing/personal data travel in plaintext. Anyone on the same network path (campus wifi, a shared hop, a compromised router) can read credentials and hijack sessions via simple packet capture. This is the most important finding in this review — it undermines every other control (auth, RBAC, etc.) if traffic can just be sniffed.

**Fix:** Terminate TLS at nginx (or an ALB/CloudFront in front of it) with a real certificate — ACM if fronted by an AWS load balancer, or Let's Encrypt/certbot directly on the box otherwise — and redirect all HTTP to HTTPS. Also set `AUTH_TRUST_HOST` / cookie `secure` behavior to match once HTTPS is live (NextAuth marks its session cookie `secure` automatically when `NEXTAUTH_URL` is `https://…`, so that env var needs to be updated too).

### 2. No login rate limiting or lockout

**Finding:** `lib/auth.ts`'s `authorize()` does a straight `bcrypt.compare` with no attempt counting, no delay, no lockout, and no CAPTCHA. There is no `middleware.ts` in the repo, so nothing else in the stack throttles requests to `/api/auth/*` either.

**Why it matters:** The login endpoint can be brute-forced without any friction beyond bcrypt's own hashing cost. Given `email`/`password` are the only factors (no SSO enforced yet — see the commented-out Shibboleth provider in `lib/auth.ts`), a scripted credential-stuffing or dictionary attack against known UT email addresses is straightforward.

**Fix:** Add rate limiting (per-IP and per-account) in front of the credentials provider — either a `middleware.ts` check backed by a small store (Upstash/Redis, or even an in-memory/DB-backed counter given the traffic scale here), or move auth behind something that already does this (an ALB + WAF rule, or finishing the Shibboleth/SSO integration that's already stubbed out, which would remove password brute-forcing as a concern entirely for anyone using SSO).

### 3. Any authenticated user can view (and attach files to) any job, including billing/PII fields

**Status: Resolved in `0.2.0-beta.3`.** Requestors are now restricted to jobs they submitted (`isJobOwnerOrElevated` in `lib/auth.ts`, applied to the detail page and both attachment routes); machinists/admins keep full access. See the CHANGELOG's Security section for that release.

**Finding:** `app/jobs/[id]/page.tsx` only checks `if (!session?.user) redirect('/login')` — there's no check that the viewer is the job's requestor, the assigned machinist, or an admin. The same is true of the attachment upload route (`app/api/jobs/[id]/attachments/route.ts`, only `requireAuth()`). Job IDs are small sequential integers, so any logged-in user can enumerate `/jobs/1`, `/jobs/2`, … and see every job's full detail — including the Billing/Sponsor section (account number, account title, bookkeeper name and address) — and can upload a file into any job's attachment list, not just their own.

**Why it matters:** This may be an intentional design choice — the `/jobs` list itself already shows every open job from every requestor to any authenticated user, so "everyone in the shop can see all shop work" already appears to be the app's model for job metadata. But the **billing/sponsor fields are a different sensitivity level** than "what part is being machined" — account numbers and bookkeeper contact info probably shouldn't be visible department-wide by default. Worth an explicit decision rather than an implicit one.

**Fix:** If open visibility is intentional for job status/description (consistent with the existing `/jobs` list), at minimum gate the Billing/Sponsor section to the job's own requestor, the assigned machinist, and admins. If full job-detail access should be restricted too, add an ownership check (`job.requestorId === currentUserId || job.machinistId === currentUserId || isAdmin`) to both the detail page and the attachment upload route, matching the pattern already used correctly for attachment *deletion* (fixed in `ed92d88` this cycle, now `requireMachinist()`).

### 4. Uploaded file type is trusted from the client and never verified server-side

**Status: Resolved in `0.2.0-beta.3`.** Uploaded content is now verified against magic bytes (`lib/file-type.ts`) instead of the client-supplied MIME type, and downloads always force `Content-Disposition: attachment` regardless of stored type. See the CHANGELOG's Security section for that release.

**Finding:** `app/api/jobs/[id]/attachments/route.ts` checks `ALLOWED_TYPES.has(file.type)` — `file.type` is the MIME type the *browser* reported for the upload, which is trivially spoofable (a raw HTTP client can set `Content-Type` to anything in the multipart body). The actual file bytes are never inspected. That client-supplied type is then stored as the S3 object's `ContentType` (`lib/s3.ts: uploadAttachment`), and the download route (`GET .../attachments/[attachmentId]`) redirects straight to a presigned S3 URL with no `ResponseContentDisposition` override — so whatever content-type was claimed at upload is what gets served back, inline, with no forced download.

**Why it matters:** The allowlist (`application/pdf`, `image/png`, `image/jpeg`) blocks the obvious `text/html`/`image/svg+xml` script-injection vectors, so this isn't wide open — but it's still trusting an attacker-controlled field for a security-relevant decision, and PDFs in particular can carry embedded JavaScript that some PDF viewers execute. This is exactly the kind of gap that becomes exploitable later if the allowlist is ever loosened without revisiting this.

**Fix:** Two independent, low-effort layers: (1) verify the actual file signature server-side (magic bytes) instead of trusting `file.type` — a small library or a manual check of the first few bytes covers PDF/PNG/JPEG easily; (2) force downloads with `ResponseContentDisposition: 'attachment; filename="..."'` on the presigned URL regardless of content-type, so nothing is ever rendered inline by the browser.

## Medium severity (operational / infrastructure)

### 5. Plaintext GitHub personal access token committed to the deploy host's git config

**Finding:** Earlier this engagement, `~/pge-shop/.git/config` on the AWS dev box was found to have a GHE personal access token embedded directly in the remote URL (`https://<user>:<token>@github.austin.utexas.edu/...`). It's already failing auth (403) as of this review, so it's not currently live, but it demonstrates the credential was handled insecurely at some point and the practice could recur.

**Fix:** Rotate/revoke that token if it hasn't been already, remove it from `.git/config` on the host (switch to an SSH deploy key or simply stop needing `git pull` on that box at all, since the CI/CD runner already checks out into its own ephemeral workspace and doesn't need this remote), and avoid ever putting credentials in a remote URL going forward.

### 6. Self-hosted CI/CD runner executes on the same host that serves production, including on `pull_request`

**Finding:** `.github/workflows/ci-cd.yml` triggers on both `push` and `pull_request`, and the self-hosted runner (`actions.runner._services.pge-shop-ec2`) runs directly on the EC2 box as the `ubuntu` user — the same user that owns the running Docker containers and can rebuild/restart them. `npm ci`, `npm test`, and `npm run build` all execute arbitrary repo-controlled code (including any transitive dependency's install/build scripts) on that host.

**Why it matters:** For a solo/trusted-team repo this is lower risk, but it's a well-known anti-pattern: a malicious or compromised dependency (supply-chain attack), or a PR from anyone with write access to open one, runs with the same privileges as the deploy process itself, on the exact machine serving production traffic. There's no isolation between "run untrusted-ish CI code" and "control the live site."

**Fix:** At minimum, restrict the `pull_request` trigger to not run on the self-hosted runner for external/untrusted contributors (GitHub's `pull_request_target` guidance, or simply require manual approval for first-time contributors — already partially mitigated if this repo has no outside contributors). Longer-term, moving build/test to an ephemeral runner (even a small separate EC2 instance or GitHub-hosted runner) and keeping only the deploy step on the production host would remove this class of risk entirely.

### 7. Required CI status check is being bypassed on every push

**Finding:** Every push to `main` this session returned `remote: Bypassed rule violations ... Required status check "Typecheck, lint, build" is expected`. The branch protection rule exists but isn't actually blocking merges for whichever accounts have bypass permission.

**Fix:** Review who has bypass rights on the `main` branch protection rule in repo settings and confirm that's intentional (e.g., admins bypassing during active development is a reasonable tradeoff for a small team, but worth being a conscious choice, not a surprise).

### 8. Seed script uses a single shared weak password for all dummy accounts

**Finding:** `scripts/seed-dummy-data.ts` hashes and assigns `password123` to every seeded test user (`requestor@utexas.edu`, `machinist@utexas.edu`, etc.), documented in the script's own output.

**Why it matters:** Fine for a dev/demo database (which is all this currently is), but worth a hard rule: this script must never be pointed at a database that also holds real accounts, and the well-known seed credentials should be treated as public.

**Fix:** No code change needed — just document (e.g., in the README's deployment section) that `db:seed` is dev-only and must never run against production, and rotate/remove the seeded accounts before any real production cutover.

## Lower severity / worth confirming

- **Deployment file drift:** `docker-compose.aws.yml` (referenced by the README and by the CI/CD workflow until earlier this session) doesn't match what's actually running (`docker-compose.yml`, with nginx + MinIO). This was already corrected in `.github/workflows/ci-cd.yml` and the README this session, but it's a reminder that stale infra-as-code can lead to accidental misconfiguration (e.g., someone "restoring" the wrong file and reopening the port-80 conflict, or worse, applying different — weaker — settings than what's actually live).
- **User enumeration via timing:** `authorize()` returns `null` for both "no such user" and "wrong password," which is good, but a nonexistent email skips the `bcrypt.compare` call entirely while a real one doesn't, creating a small timing difference an attacker could use to enumerate valid emails. Low severity given rate limiting (once added, see #2) would make this impractical to exploit at scale.
- **MinIO console port**: `docker-compose.yml` exposes MinIO's admin console on `9001:9001` directly on the host, with a comment already flagging "restrict to internal access in production." Worth confirming the EC2 security group doesn't actually allow inbound `9001` from the internet (the README only mentions opening `22`/`80`, so this is likely fine, but worth a one-time explicit check rather than relying on that being remembered).

## What's already solid

Worth stating plainly so this doesn't read as all-bad:

- Passwords are hashed with bcrypt (cost 10), never stored/compared in plaintext.
- All database access goes through Drizzle ORM's parameterized query builder — no raw string-interpolated SQL was found anywhere in the app, so standard SQL injection isn't a concern here.
- Role-based authorization (`requireAuth`/`requireMachinist`/`requireAdmin`) is applied consistently across the API routes that need it, and update schemas (e.g. `updateJobSchema`) are tightly scoped so a lower-privileged role can't mass-assign fields it shouldn't touch (billing info, requestor identity, etc. aren't patchable via the machinist-facing endpoint).
- Two real bugs fixed this session were genuine security-relevant fixes, not just polish: attachment deletion previously only required *any* logged-in user (`requireAuth`) rather than a machinist/admin (`ed92d88`), and the job-number search had an unhandled integer-overflow crash reachable by any authenticated user (`8b4046f`).
- Session lifetime is a reasonable 8 hours, not indefinite.
- Secrets (`.env`) are gitignored and not committed to the repository itself.

## Suggested priority order

Still open, in order:

1. TLS (#1) — nothing else matters much if traffic is sniffable. Blocked on getting a domain name for this deployment.
2. Login rate limiting (#2), still directly reachable by anyone today.
3. The infrastructure items (#5–#8) — rotate the exposed token, decide on the self-hosted runner's trust boundary, and confirm the branch-protection bypass is intentional.

\#3 (job/attachment ownership) and #4 (file upload verification) are resolved — see their status notes above.
