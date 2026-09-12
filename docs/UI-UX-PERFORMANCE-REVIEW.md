# UT ShopTrack UI/UX and Performance Review

Review date: September 11, 2026

Latest implementation: Real-time job filtering was committed and pushed as `e00a44d`; deployment verification is still pending. The local activity-page asset failure is fixed by separating development and production build output. See the implementation sections below.

Follow-up status: The reviewed UI/workflow fixes are implemented and live, including the numeric-search boundary correction and error associations/announcements. The latest independent checks passed on both the jobs page and API. Performance recommendations and remaining visual/assistive-technology verification are still outstanding.

## Scope and limitations

Reviewed deployment: [http://3.21.240.225/](http://3.21.240.225/).

This follow-up inspected deployed HTML and referenced JavaScript, including authenticated admin-session requests to the jobs list, Completed/Cancelled/Urgent filters, new-job form, job detail, and admin dashboard. The repository's explicit test account was used for ordinary authentication. No jobs, attachments, access requests, or user records were created or changed.

This second follow-up used Playwright browser automation against the live deployment (the first follow-up was HTTP/source-only). The previously reported out-of-range numeric-search crash was reproduced live (confirmed via server logs: Postgres error `22003`, `value "2147483648" is out of range for type integer`), then re-verified as fixed after deployment. Response timings recorded earlier in this document are small-sample network measurements from the prior pass, not Core Web Vitals or load-test results, and were not recollected in this pass.

Local source was reviewed through `8b4046f`, which fixes the numeric-search overflow. Changes from `b874035` (personal views, ID search, overdue logic), `6a87df4` (control names and other accessibility improvements), and `c1177ac` (field-error associations and alert announcements) are all now visible in the served build — confirmed by fetching the deployed new-job JavaScript bundle directly and finding `aria-describedby`, `aria-invalid`, and `job-date-required-error` present. The axe-core audit is reported in the accessibility commit message; it was not independently rerun in this session.

Brand constraint: preserve the official university burnt orange (`#BF5700`). Contrast recommendations should adjust foreground text, opacity, or link styling while retaining that color.

## Recommendation tracking table

Local implementation and deployed evidence are tracked separately. A completed source change is not marked complete on the live site when the served code lacks it. Effort estimates are preliminary.

| # | Area | Local implementation | Deployed verification / remaining work | Effort |
| --- | --- | --- | --- | --- |
| 1 | Verification | Prior source and isolated handler/date checks passed. | Browser-automated (Playwright) checks now cover login, search (including the crash boundary), My Jobs/Assigned to Me, and the new-job form. Keyboard/screen-reader interaction walkthroughs remain outstanding. | Small |
| 2 | Mobile | Implemented for job-list cards and stacked line items in `4ab455e`. | Live in checked HTML/JavaScript: job cards include due date, priority, and assignee; line items use the responsive single-column grid. Visual layout verification remains pending. | Visual verification |
| 3 | Accessibility | `6a87df4` adds missing control names; `c1177ac` connects Date Required/Description errors with aria-describedby/aria-invalid and makes action errors alerts. | **Confirmed deployed**: fetched the live new-job bundle (`page-fbf0c7aff7e1806c.js`) directly and found `aria-describedby`, `aria-invalid`, and `job-date-required-error` present. A persistent visible search label is now included in the local real-time-filter implementation; deployment remains pending. | Complete in served code |
| 4 | Summary cards | Implemented in `3c7934c`; matching filter links and focus styling reviewed. | Live: authenticated jobs/dashboard HTML and JavaScript include all three matching filter links. | Complete in served code |
| 5 | Job discovery | Personal views, ID search, and the numeric-overflow fix (`8b4046f`) implemented. | Confirmed live in the latest independent pass: 12 page/API checks passed, including current job 278, #278, integer max, overflow, prefixed overflow, and a very long number. Prior sample job 213 is no longer present; current test IDs were discovered from the live list. | Complete in tested flows |
| 6 | Overdue logic | Implemented in `b874035`: requested due date determines lateness; completed/cancelled jobs excluded; queue age tracked separately. | Live dashboard now emits overdue-day labels. Source confirms deadline-based logic. | Complete in reviewed code/live output |
| 7 | Loading and errors | Open: no route-level loading/error components. | Recovery and loading interactions were not browser-tested. Add skeletons and actionable retry states. | Medium |
| 8 | Dashboard speed | Open: five independent dashboard queries remain sequential. | Runtime query timings were not inspected. Parallelize and measure the improvement. | Small |
| 9 | Uploads | Open: files are still fully buffered by the app before storage upload. | Direct-upload/progress behavior was not verified. The duplicate-job retry fix is a separate completed source change. | Medium–large |
| 10 | Database performance | Pending profiling. | No query plans or representative-load measurements available. Profile before adding indexes or caching. | Medium |
| 11 | Deployment | Personal-view, ID-search, overdue, accessible-name, error-association, and numeric-search-crash changes are all now served. | **Confirmed deployed** end-to-end via CI/CD (`gh run view`) and direct bundle inspection. Build/production resource contention remains unverified. | Verification |
| 12 | Measurement | Initial live HTTP timings collected (prior pass). | Partial: sampled responses were fast, but rendering, LCP, INP, CLS, mobile conditions, and concurrency remain unmeasured. | Medium |
| 13 | Real-time filtering | Implemented locally: 300 ms search debounce; immediate status/priority/Clear; personal scope and sort preserved; page reset; visible pending status; persistent labels. | Ten focused component tests passed. Deployment and browser interaction verification remain outstanding. | Deployment / verification |
| 14 | Local development assets | Fixed: development uses `.next-dev`, while production build/start retain `.next`, preventing build output collisions. | Local activity HTML returned 200, but CSS and most JavaScript returned 404 before the fix. After the server restarted, the authenticated page and all referenced CSS/JavaScript returned 200. Browser visual verification remains pending. | Complete locally |
| 15 | Activity filter consistency | Implemented locally: uniform 40 px controls and button, aligned labels, consistent padding, and responsive grid. | Local markup and generated CSS verified; visual browser verification pending. | Complete locally |

Latest local validation at `8b4046f`: typechecking passed; lint passed with the existing `<img>` warning in `app/layout.tsx`.

## Activity filter styling

The activity filters now share a 40 px height, border, corner radius, font size, horizontal padding, and label styling. Native date controls have an explicit height and normalized WebKit date-value alignment. The Filter button matches the fields, and the responsive grid stacks fields on small screens before forming a single row on wide screens. The official university burnt orange is preserved. Source/type checks and local HTTP/CSS verification cover the change; visual browser verification remains pending.

## Local activity-page repair

The running development server shared `.next` with a production validation build. Its activity-page HTML and database queries succeeded, but its referenced stylesheet and most JavaScript chunks returned 404, leaving the page unstyled and unable to hydrate. Development output now uses `.next-dev`; production output remains `.next` for the existing Docker deployment. The development directory is ignored by Git and its generated route types are included in TypeScript checks. The config change restarted the local server automatically.

Verification uses authenticated HTTP requests and asset responses; no connected browser was available for visual testing. This is a local development fix, not evidence of a production activity-page defect.

## Real-time filtering implementation (pushed, deployment unverified)

- Replaced the manual Filter button with a 300 ms search debounce and immediate status/priority changes. Enter still applies search immediately; clearing search or using Clear applies immediately.
- URL query parameters retain personal-view scope and sorting; filter changes reset pagination to page 1. Client-side replacement avoids adding a history entry for every search and preserves scroll position.
- Existing results remain mounted while route transitions run. An “Updating jobs…” status and busy state communicate progress without disabling the inputs.
- Draft text is preserved when an earlier response commits. External URL navigation resynchronizes the controls and cancels pending typing; unmount and Clear also cancel debounce timers. Composition input waits until composition ends.
- Added persistent visible Search jobs, Status, and Priority labels. Clear returns focus to search. The official burnt orange remains unchanged.
- Added `npm test` with ten real-component regression checks for debouncing, immediate combined filters, Clear/scope preservation, intermediate response handling, external navigation, timer cleanup, composition, Enter, empty search, and normalized no-op search. CI now runs these tests.
- Source typechecking, all ten tests, lint, and the production build passed. Lint retains the existing image warning. The build succeeded after allowing access to the existing Google Fonts dependency. Browser behavior and production deployment have not been verified for this new feature. Earlier live-verification records in this document refer to the previously deployed build.

## Latest independent verification

Reviewed local commit `8b4046f` and rechecked the deployment using authenticated HTTP requests and direct asset inspection. This pass did not run browser automation, inspect CI runs, or read production logs; earlier review notes about those checks are retained as prior results.

- All 12 search requests returned HTTP 200: each of `278`, `#278`, `2147483647`, `2147483648`, `#2147483648`, and `999999999999999999999999999999` was checked on both `/jobs` and `/api/jobs`. Valid current IDs returned the job; the unmatched boundary/overflow values returned empty results. No further findings in the range-guard fix.
- New-job asset `page-fbf0c7aff7e1806c.js` contains both field-error IDs, `aria-invalid`, `aria-describedby`, and `role:"alert"`. Current detail asset `page-32bc6a6a6e6c3656.js` includes the attachment name and action alert roles. The error-accessibility implementation is now confirmed in served code; announcement behavior still needs assistive-technology testing.
- Requestor My Jobs navigation, the hidden personal-scope field, and scope-preserving sort links passed inspection. Earlier mobile cards, stacked fields, summary links, and inert pagination remain served.
- The historical sample job 213 returned 404, so this pass discovered current job 278 from the live list and verified its detail page and search results. The old ID is no longer used as a regression fixture.
- Typecheck passed. Lint passed with the existing `<img>` warning. No source files or live job/user records were modified by this review.

## Resolved follow-up finding

**P2 — Out-of-range numeric searches crash the jobs page. Fixed in `8b4046f`.** An authenticated GET to `/jobs?search=2147483648` returned HTTP 500. The parser treated any digit-only string as a job ID, but `jobs.id` is a PostgreSQL `integer` column (max `2147483647`); the query failed with Postgres error `22003` (`value "2147483648" is out of range for type integer`) instead of throwing a caught, friendly error.

Fix: the parsed value is now capped at `2147483647` in both [the jobs page](../app/jobs/page.tsx) and [the jobs API](../app/api/jobs/route.ts) (which share this parsing pattern) — a match outside that range now falls back to description search instead of hitting the database with an invalid integer. Reproduced live pre-fix (500, confirmed via server logs), then re-verified live post-deploy: `search=2147483648` now returns 200 with "0 jobs", and the in-range boundary `search=2147483647` still resolves correctly.

## Deployed evidence

- Authenticated admin requests to Assigned to Me and My Jobs now produce the intended personal-view output, replacing the previous Open Jobs fallback. The admin test account has no matching jobs in those sampled personal views.
- A separate login with the explicit test requestor account confirmed My Jobs navigation, a hidden `mine=1` filter input, and sort links retaining the personal scope.
- `/jobs?search=%23213` now returns a link to job 213. The out-of-range numeric case (`search=2147483648`), which previously returned HTTP 500, now returns 200 with a normal "0 jobs" Open Jobs page after `8b4046f` deployed.
- The dashboard now contains “d overdue” labels; local source bases them on requested deadlines and excludes completed/cancelled jobs.
- Live status/priority filters now have accessible names. The job-detail upload input is also named, and no unnamed controls were found by the HTML check on the new-job or job-detail pages. The search input still relies on placeholder text rather than an explicit persistent label; this check is not a full accessibility audit.
- The served new-job asset is now `page-fbf0c7aff7e1806c.js` (superseding the previously-checked `page-13b30751e0b4e7c1.js`) and includes `job-date-required-error`, `job-description-error`, `aria-invalid`, and `aria-describedby` — `c1177ac`'s error-association changes are confirmed deployed. The checked detail asset was `page-447af658801a3333.js` and includes the upload control name.
- Earlier mobile cards, stacked fields, summary-card links, labels, and inert pagination remain live.
- No job, attachment, access-request, or user records were created or changed. Visual, keyboard, screen-reader, and mutation-failure-path testing remains outstanding.

### Live response timing sample

Samples retained from the preceding follow-up, not newly collected in the latest independent pass. These are single HTTP samples, not browser-render timings or production percentiles.

| Request | Time to initial response | Total HTML response |
| --- | --- | --- |
| Assigned to Me (admin) | 230 ms | 271 ms |
| My Jobs (test requestor) | 254 ms | 301 ms |
| Search for #213 | 159 ms | 202 ms |
| Admin dashboard | 216 ms | 323 ms |
| New-job form | 231 ms | 271 ms |
| Job detail | 356 ms | 382 ms |

The dashboard response was about 92 KB of HTML, excluding other browser assets. No Core Web Vitals score is claimed.

### Resolved high-priority findings

| Original finding | Resolution | Reviewed commit(s) |
| --- | --- | --- |
| Completed jobs were unreachable through the filter, and cancelled jobs appeared in the default open queue. | Explicit status filters now override the default open queue. The default excludes both completed and cancelled jobs. | `182dc9e` |
| Calendar dates could display a day early. | Date-only values use `parseISO` in the homepage, jobs table, and job detail page. The follow-up correction uses `differenceInCalendarDays` for queue age, avoiding undercounts across daylight-saving transitions. | `9668c58`, `f4bcfb6` |
| Retrying a failed attachment upload could create a duplicate job. | The form retains the created job ID, locks the saved job fields, and offers “Retry Attachment Upload.” Subsequent attempts upload to the existing job. | `f5504e1` |
| Failed material updates could appear saved. | Material checkboxes restore their previous values and display errors on failure. Assignment changes now also roll back on failure. | `722556f` |

### Follow-up verification

- Reviewed the status-filter logic: explicit Completed and Cancelled filters override the open-queue exclusions.
- Confirmed corrected calendar-date formatting in America/Chicago.
- Targeted handler checks verified that retries after both HTTP and network upload failures create only one job and reuse its ID.
- Targeted handler checks passed for successful material saves, rollback of both material fields on failure, and assignment rollback on failure.
- The initial follow-up found a DST undercount in queue age. After commit `f4bcfb6`, all 12 calendar-day cases passed across America/Chicago and UTC, including spring/fall transitions, midnight boundaries, same-day counts, and longer intervals. No further findings were identified in that correction.
- Typechecking passed after the four fixes and again after the DST correction. Lint passed after the four fixes with the existing `<img>` warning in `app/layout.tsx`.
- Second follow-up: reproduced the out-of-range numeric-search crash live (server logs showed Postgres `22003`), fixed it in `8b4046f`, and re-verified live post-deploy (200/"0 jobs" for the crashing input, correct behavior at the exact int4 boundary). Also directly fetched the deployed new-job JS bundle and confirmed the `c1177ac` error-association markers are present, resolving the earlier "not yet deployed" open question.

The historical checks above used code inspection and isolated handler/date tests. Live HTTP/browser evidence from both follow-ups is recorded separately above; mutation failure paths, full keyboard traversal, and screen-reader behavior remain unverified.

### Everyday workflow improvements

- Implemented and deployed: “My Jobs” for requestors and “Assigned to Me” for machinists/admins; query scope is retained in filter forms and table links.
- Implemented and deployed: bare or #-prefixed job-number search, alongside description search, with the out-of-range numeric boundary fixed (`8b4046f`).
- Implemented and deployed: deadline-based overdue calculation with separate queue-age/lateness values.
- All three are confirmed live and working, including the previously-broken numeric boundary case.

### Relevant implementation files

- [Job filters and search](../app/jobs/page.tsx)
- [Table date formatting, mobile columns, and pagination](../components/JobsTable.tsx)
- [New-job submission and form layout](../app/jobs/new/page.tsx)
- [Material updates and machinist actions](../components/JobActions.tsx)
- [Summary-card interactions](../components/StatsCards.tsx)
- [Inline login labels](../components/InlineLoginForm.tsx)
- [Attachment controls](../components/AttachmentsPanel.tsx)
- [Dashboard overdue calculation](../app/admin/page.tsx)

## Performance priorities

These are implementation risks and optimization opportunities, not measured production bottlenecks.

### 1. Parallelize dashboard queries

Five independent dashboard queries currently run sequentially. The jobs list already uses parallel fetching; apply that pattern to the dashboard to reduce cumulative database wait time.

Implementation: [Admin dashboard](../app/admin/page.tsx).

### 2. Add loading and recovery states

There are no route-level loading or error components. Add table skeletons and actionable errors while data loads or fails. Use route loading boundaries or component-level Suspense where appropriate so users receive immediate feedback during navigation.

Reference: [Next.js 14 data-fetching patterns and streaming guidance](https://nextjs.org/docs/14/app/building-your-application/data-fetching/patterns).

### 3. Reduce upload memory pressure

Files are fully buffered through the app before reaching storage, with a 25 MB limit. Concurrent uploads could increase memory pressure. Consider direct uploads using signed storage requests, with progress indicators and retry controls.

Implementation: [Attachment upload handler](../app/api/jobs/[id]/attachments/route.ts).

### 4. Profile database work as the archive grows

Every jobs-list request recomputes whole-table statistics. Description search uses substring matching without a matching search index in the supplied schema. Measure query plans and timings with representative data before adding caching or indexes.

Implementation: [Jobs page](../app/jobs/page.tsx) and [database schema and statistics view](../schema.sql).

### 5. Check deployment resource contention

The README says builds share a small production server. If that deployment description is still accurate, builds could affect response times. Move builds off the serving machine if resource contention is confirmed.

Reference: [Deployment documentation](../README.md).

## Measurement follow-up

The deployed site is reachable and initial HTTP measurements are recorded above. When browser access is available, measure desktop and mobile rendering and interactions, including authenticated job-list, job-detail, submission, and admin workflows.

Use these Core Web Vitals targets at the 75th percentile, segmented by mobile and desktop:

| Metric | Target |
| --- | --- |
| Largest Contentful Paint (LCP) | 2.5 seconds or less |
| Interaction to Next Paint (INP) | 200 milliseconds or less |
| Cumulative Layout Shift (CLS) | 0.1 or less |

These are targets, not measured results for UT ShopTrack. Use production-build lab tests for diagnosis and real-user measurements to assess actual experience. Lighthouse does not directly measure INP; interaction testing and field measurements are needed.

Reference: [Core Web Vitals guidance](https://web.dev/articles/vitals?hl=en).

## Suggested implementation order

The reviewed UI/workflow fixes — high-priority fixes, summary links, mobile layouts, personal queues, job-number search (including the out-of-range boundary), deadline-based overdue output, and error associations/announcements — are implemented and confirmed in live responses or served code. Remaining work is entirely in the Performance priorities and Measurement follow-up sections below, plus the minor usability item noted in the tracking table (an explicit persistent search label).

1. Verify mobile layouts and the full set of fixes visually and with keyboard/screen-reader interaction in the browser (the two remaining browser-automation gaps: visual layout and assistive-tech behavior).
2. Consider an explicit persistent search label, preserving official university colors (the one open, minor usability item).
3. Add loading and recovery states and parallelize dashboard queries.
4. Measure production performance, then address uploads, database queries, and build resource contention based on the results.
