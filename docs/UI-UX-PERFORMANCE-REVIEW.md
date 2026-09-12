# UT ShopTrack UI/UX and Performance Review

Review date: September 11, 2026 (America/Chicago). Audit baseline: `d892f52` on `main`. The job-functionality follow-up below includes subsequent fixes and regression tests.

## Current assessment

Normal live pages and the checked assets load successfully. Open Jobs now serves the real-time filter implementation. The most important new finding is missing validation on other routes: malformed filters and oversized job IDs still produce HTTP 500 responses. Filtering consistency, pagination, and preservation of personal queue context should come next.

The Activity Log alignment fix (`d892f52`) is now confirmed in live output. A fresh authenticated recheck after the user’s deployment update found shared `h-10` heights on all five fields and the Filter button, the responsive grid, and the date-value normalization rules in the served CSS. This supersedes the earlier sample that contained the old classes. Local appearance was previously approved visually by the user; no new browser visual check was performed.

Preserve the official university burnt orange (`#BF5700`). No brand-color replacement is recommended.

## Scope and evidence

- Deployment: [http://3.21.240.225/](http://3.21.240.225/).
- Used the repository's existing test administrator for ordinary authentication. Read-only requests covered the jobs list, dashboard, activity log, users, new-job form, a current job detail, assigned queue, and boundary cases. No jobs, users, attachments, or access requests were created or changed.
- Measured three sequential HTTP requests per main route, inspected referenced production assets, and reviewed the local implementation. No load test, database query-plan inspection, production log inspection, or CI inspection was performed.
- No connected browser surface was available. This pass does not claim new visual, keyboard, screen-reader, hydration, or mobile interaction verification. The user's earlier screenshot and confirmation establish local activity-field alignment only.
- All ten existing real-time job-filter component tests passed again. They cover the component's routing/timer behavior, not real-browser navigation. Typecheck and lint passed during the preceding implementation turn, with the existing root-layout image warning; no application source changed during this audit.
- Earlier reviews reported browser/axe/CI checks. Those are historical results, not independently repeated or sufficient to mark the remaining items below complete.

## Prioritized recommendation table

| ID | Priority | Finding and evidence | Recommendation / completion criteria | Status |
| --- | --- | --- | --- | --- |
| A1 | High | Live Activity Log returns 500 for invalid job IDs, changed-by IDs, dates, and statuses. Jobs also returns 500 for invalid status/priority and an oversized detail ID. The prior search overflow fix remains effective but does not cover these routes. | Validate integer ranges, enum values, dates, and pagination before querying. Show field guidance for bad filters; return a safe not-found response for invalid detail IDs. Add focused regression coverage. | Reproduced live |
| A2 | Resolved | Fresh live HTML contains shared 40 px heights on all five activity fields and the Filter button, plus the responsive grid. The served stylesheet includes the height and date-normalization rules. | Retain the consistent control sizing. | Confirmed deployed in HTML/CSS; local appearance user-approved |
| A3 | Medium | Open Jobs applies filters automatically; Activity Log still uses a manual GET form and Filter button. | Apply selects immediately, debounce Job # by 300 ms, and apply complete valid dates. Validate reversed ranges, retain results with an updating indicator, reset pagination, and make Clear immediate. Keep newest-first ordering. | Recommended; not implemented |
| A4 | Medium | Both activity and jobs accept `page=999999`, displaying “Page 999999 of 3” with empty results. Activity's disabled Previous is still a normal link with only pointer suppression. | Clamp or redirect pages after counting results. Render unavailable pagination as inert text, following the existing JobsTable pattern. Verify keyboard behavior. | Reproduced live / confirmed in source |
| A5 | Medium | On Assigned to Me, summary links go to `/jobs?status=…` or `/jobs?priority=urgent`, dropping `assigned=1`. Statistics are global while the queue is personal. The same shared implementation is used for My Jobs. | Make card counts and links match the current queue, or explicitly label them as shop-wide navigation. Preserve personal scope when cards are presented as queue filters. | Assigned links confirmed live; shared behavior confirmed in source |
| A6 | Medium | The Open Jobs status option says “All Statuses,” but the default query excludes completed and cancelled jobs. The heading remains “Open Jobs” even when selecting Completed. | Use “Open statuses” / “All open jobs” for the default, or implement a true all-status option. Make the heading reflect completed/cancelled views. | Confirmed in source |
| A7 | Medium | No route-level loading or error components exist. Job filters show pending state, but navigation and server failures have no application-specific recovery UI. | Add useful route loading states and actionable retry/back controls for jobs and admin pages. Validate with delayed responses and failures. | Open; failure URLs above demonstrate the need |
| A8 | Medium | Activity notes are hidden below `md` and truncated on larger screens, with no full-note expansion in the log. Job detail remains a separate way to inspect history. | Offer expandable notes or mobile activity cards so users can read full changes without leaving the log. Check small-screen table overflow visually. | Confirmed in source; visual impact unmeasured |
| A9 | Medium | Sort direction is conveyed by icons without `aria-sort`; active navigation has no `aria-current`. | Add semantic sort/current-page state and verify with keyboard and assistive technology. Keep the earlier field labels and error associations. | Confirmed in source |
| A10 | Medium | Dashboard performs five independent database queries sequentially; activity performs three. Jobs runs its three queries in parallel but recomputes global statistics on every applied filter. | Parallelize independent admin queries. Measure statistics/query cost under realistic data and filtering before choosing scoped caching or indexes. | Source-confirmed opportunity; no measured DB bottleneck |
| A11 | Medium | Attachment handling parses multipart data and creates a full Buffer before storage; the 25 MB check occurs after multipart parsing. | Profile memory with concurrent uploads. Consider streaming or signed direct uploads, with size/type enforcement, progress, and recoverable retries. | Source-confirmed scaling risk; no load measurement |
| A12 | Measurement | Current timings cover HTTP responses only. Mobile rendering, LCP, INP, CLS, concurrency, and build-time contention remain unknown. | Run production browser measurements and collect field metrics. Assess self-hosted build/deployment resource use before moving builds or increasing resources. | Outstanding |
| A13 | High before deployment | Attachment deletion required only authentication, although the UI restricts deletion to machinists/admins. A unit test reproduced requestor access to the handler. | Handler now uses `requireMachinist`; permission tests cover denied requestors and allowed machinists/admins. | Fixed locally; not deployed |
| A14 | High before deployment | Status updates and history inserts were separate writes; reopening retained completion metadata, and same-status completion notes replaced completion attribution. | Status/history now share a transaction with a job-row lock. Reopening clears completion fields; same-status notes preserve original attribution; empty duplicate changes are no-ops. | Fixed locally; unit tests pass; no real-DB concurrency test |
| A15 | Medium | Save buttons could reactivate before refreshed props arrived; editable in-flight fields risked discarding new text; attachment retry errors stayed visible after success. Assignment/material saves lacked confirmation. | Track successful saves immediately, preserve drafts on refresh, lock in-flight fields, show autosave feedback, and clear attachment retry errors. | Fixed locally; component tests pass |


Priorities reflect observed user impact. Boundary failures are reproducible; resource concerns are hypotheses to measure, not claims of current slowdowns.

## Live failure and edge-case evidence

Each URL below was requested once during this audit. Ordinary baseline requests succeeded. These are malformed-filter/link cases, not evidence that normal browsing consistently fails.

| Request | Observed result |
| --- | --- |
| `/admin/activity?jobId=2147483648` | HTTP 500 |
| `/admin/activity?jobId=abc` | HTTP 500 |
| `/admin/activity?changedById=2147483648` | HTTP 500 |
| `/admin/activity?from=invalid` | HTTP 500 |
| `/admin/activity?status=invalid` | HTTP 500 |
| `/jobs?status=invalid` | HTTP 500 |
| `/jobs?priority=invalid` | HTTP 500 |
| `/jobs/2147483648` | HTTP 500 |
| `/admin/activity?page=999999` | HTTP 200; “Page 999999 of 3,” empty results |
| `/jobs?page=999999` | HTTP 200; “Page 999999 of 3,” empty results |
| `/admin/activity?from=2026-09-11&to=2026-09-01` | HTTP 200; empty results without a reversed-range explanation |
| `/jobs?search=2147483648` | HTTP 200; prior search overflow fix still holds |
| `/api/jobs?search=2147483648` | HTTP 200; prior API search overflow fix still holds |
| `/jobs/278` | HTTP 200; current job discovered from the live list |

Activity's initial Previous link points to `?page=0` and has `opacity-40 pointer-events-none`, but neither `tabindex` nor `aria-disabled`. Pointer suppression does not make a link inert for keyboard activation. No keyboard walkthrough was performed.

## Fresh performance sample

Three sequential requests per route from the review machine, authenticated as admin, with `Accept-Encoding: identity`. Medians include network connection/latency overhead; these are not server-only timings. Full-response time covers HTML only, not assets, rendering, or interactivity. HTML sizes are uncompressed. Small sample, no controlled cold/warm-cache split.

| Route | Median time to first byte | Median full HTML response | HTML size |
| --- | ---: | ---: | ---: |
| `/jobs` | 186 ms | 295 ms | 41.7 KiB |
| `/admin` | 218 ms | 356 ms | 71.0 KiB |
| `/admin/activity` | 190 ms | 312 ms | 106.1 KiB |
| `/admin/users` | 171 ms | 216 ms | 33.3 KiB |
| `/jobs/new` | 161 ms | 200 ms | 18.2 KiB |

The authenticated `/` request, including its redirect to jobs, had a 446 ms median time until the final response headers and 521 ms until full HTML. It is not directly comparable to the direct-route first-byte timings.

All 18 unique CSS/JavaScript assets referenced by the sampled routes returned HTTP 200. The largest checked JavaScript file was 172,834 bytes uncompressed; a separate gzip request transferred 53,742 bytes with `Cache-Control: public, max-age=31536000, immutable`. This confirms compression and long-lived caching for that asset, not a complete page transfer budget or browser cache test.

The activity response was the largest HTML sample at 106.1 KiB for its current 50-row page. This is a baseline to track as features/data change, not sufficient evidence to reduce the page size. Normal route timings alone do not justify describing the site as slow.

### Measurement targets

Use field measurements at the 75th percentile, segmented by desktop and mobile: LCP ≤ 2.5 seconds, INP ≤ 200 ms, CLS ≤ 0.1. None was measured here. Browser lab tests should diagnose issues; real-user metrics establish whether visitors meet the targets. See [Web Vitals guidance](https://web.dev/articles/vitals).

For perceived navigation performance, [Next.js 14 loading UI guidance](https://nextjs.org/docs/14/app/building-your-application/routing/loading-ui-and-streaming) explains how route loading boundaries provide immediate feedback while content loads. Adding one does not remove the need to validate inputs or optimize queries.

## Confirmed improvements and retained fixes

| Area | Current evidence | Remaining verification |
| --- | --- | --- |
| Real-time Open Jobs filtering (`e00a44d`) | Live jobs bundle contains “Updating jobs,” “Filter jobs,” and “Search jobs.” Local source implements 300 ms debounce, immediate selects/Clear, scope/sort preservation, pagination reset, composition handling, and stale-draft protection. All ten component tests passed again. | Browser interaction, Back/Forward behavior, focus, and screen-reader announcement checks |
| Activity control alignment (`d892f52`) | Common 40 px field/button height and responsive grid confirmed in fresh live HTML; height and date-normalization rules confirmed in served CSS. User confirmed local appearance. | No new browser visual walkthrough performed |
| Development asset isolation (`d892f52`) | Development uses `.next-dev`; production retains `.next`. Previous local HTTP verification confirmed repaired assets after the config restart. | No new production change is required for the local asset collision itself |
| Search overflow correction (`8b4046f`) | Jobs page and API both still return 200 for `2147483648` search. | Extend equivalent validation to other inputs/routes under A1 |
| Earlier mobile, labels, error associations, overdue, and personal navigation work | Retained in current source; prior review recorded deployed evidence. | Fresh visual/assistive-technology verification remains outstanding; no blanket accessibility pass claimed |

## Job-functionality unit-testing follow-up

Added 43 unit/component tests, bringing `npm test` to **53 passing tests**. These exercise real TypeScript handlers, schemas, and React components; external database, authentication, storage, router, and HTTP effects are mocked. The helper rejects unmocked imports of live database/auth/storage/mail services. No production data is used as a mutation fixture.

| Test file | Tests | Coverage |
| --- | ---: | --- |
| [job-actions.test.cjs](../tests/job-actions.test.cjs) | 15 | Status enablement, payloads, in-flight locking, duplicate-save prevention, failed-save retry, notes, refresh/draft synchronization, assignment/unassignment, materials, visible autosave feedback, admin delete confirmation/navigation |
| [job-status-api.test.cjs](../tests/job-status-api.test.cjs) | 8 | Status/history recording, completion attribution, reopening, same-status notes, atomic failure handling, duplicate no-op, invalid status/denied actor, missing job |
| [job-update-api.test.cjs](../tests/job-update-api.test.cjs) | 6 | Assignment/materials/notes/priority payloads, schema validation, status-history bypass prevention, role guards, missing job |
| [attachments.test.cjs](../tests/attachments.test.cjs) | 6 | No-file submission, upload success/failure, retained retry file, download links, hidden deletion controls, retry-error clearing, serialized deletion UI |
| [job-attachments-api.test.cjs](../tests/job-attachments-api.test.cjs) | 8 | File type/size checks, stored bytes/metadata, storage failure handling, delete permissions, signed downloads, missing attachments |
| [job-filters.test.cjs](../tests/job-filters.test.cjs) | 10 | Existing debounce, immediate filters/Clear, personal scope, pagination reset, composition, Enter, and response ordering checks |

New tests reproduced failures before fixes: three status/notes UI save-state cases, two attachment UI retry/concurrency cases, four status/history consistency cases, and the attachment delete authorization case. All pass after the local fixes. The status transaction test uses a transactional database double; it verifies handler boundaries and rollback intent, not PostgreSQL lock behavior under real concurrent requests.

The reported disabled Update Status button was checked directly: selecting a different Status enables it. Assignment and Materials save immediately, and Machinist Notes uses Save Notes. A status-change note alone still does not enable Update Status. The UI now explains the button's scope and displays “Saving…” / “Saved” feedback for automatic assignment/material saves. The original report did not identify which field was changed, so no claim is made that an otherwise disabled Status dropdown was reproduced.

Read-only production smoke check: `/jobs/278` returned HTTP 200 with Machinist Actions and all three named action fields. All ten referenced JavaScript assets returned 200. No live saves, uploads, deletes, or status transitions were performed.

Validation: all 53 tests and typecheck passed; lint passed with the existing root-layout `<img>` warning. The production build also passed. Browser interactions, end-to-end new-job creation, real PostgreSQL rollback/concurrency, and storage integration remain outside this unit-test pass. Earlier audit items, including URL/input validation (A1), remain open.

## Implementation references

- [Activity query parsing, controls, notes, and pagination](../app/admin/activity/page.tsx)
- [Jobs query parsing, status defaults, heading, and statistics](../app/jobs/page.tsx)
- [Job detail ID parsing](../app/jobs/[id]/page.tsx)
- [Real-time job filters](../components/JobFilters.tsx) and [component tests](../tests/job-filters.test.cjs)
- [Summary-card links and labels](../components/StatsCards.tsx)
- [Jobs table sort and pagination semantics](../components/JobsTable.tsx)
- [Navigation state](../components/Navbar.tsx)
- [Dashboard query sequence](../app/admin/page.tsx)
- [Upload buffering and validation](../app/api/jobs/[id]/attachments/route.ts)
- [SQL indexes and statistics view](../schema.sql)
- [Build output configuration](../next.config.mjs) and [CI/deployment workflow](../.github/workflows/ci-cd.yml)

## Suggested implementation order

1. Fix shared route/filter validation and invalid pagination (A1/A4); add boundary regression checks.
2. Implement automatic activity filters with valid-date/range handling (A3). Activity alignment (A2) is now confirmed deployed.
3. Clarify status labels and personal-queue summary behavior (A5/A6); improve note access and semantic state (A8/A9).
4. Add loading/recovery UI and parallelize independent admin queries (A7/A10).
5. Complete browser and field measurements; prioritize upload, database, and build-resource work from the results (A10–A12).

The initial audit changed documentation only. The subsequent job-functionality follow-up adds tests and the local fixes recorded in A13–A15. Deployment of those follow-up fixes has not yet been verified. No new browser verification is claimed.
