# Production readiness first pass — 2026-11-13

> Historical snapshot. The user subsequently clarified that the target is a Windows laptop used locally, with no hosting. The hosted-release checklist in this dated snapshot is superseded for the current task; see the local-target note at the end and [Local use](LOCAL_USE.md).

This is a readiness assessment and action list, not a production release declaration. The app has a substantial local single-instance baseline, but the external deployment and operating checks below have not been completed.

## Intended deployment

One owner uses and edits all six workspaces: healthcare, agriculture, engineering, finance, personal, and course. Configure one named user with the `editor` role and membership in those six workspaces. There is no public signup, billing, customer onboarding, or multi-tenant service requirement. Keep production authentication enabled; local unauthenticated mode is for loopback development only.

## Implemented baseline

- Workspace-scoped SQLite persistence, signed sessions, role and membership checks in the backend request middleware, same-origin frontend proxy, request-size/body-time limits, and in-process rate limits.
- The shared frontend layout gates protected routes, retains the current URL while sign-in is required, and recovers from expired sessions. Backend middleware continues to enforce authentication, role, and workspace membership for API access.
- The app uses an `AppLink` wrapper with native full-page browser navigation for internal routes. This avoids a beta Vinext dynamic-module error seen with `next/link` prefetch/navigation while retaining query strings and cookies.
- Durable ingestion and recovery, bounded retrieval corpus, graph construction and saved evidence, readiness endpoint, checksummed online SQLite backups, and a single-instance backend container definition.
- Each workspace database atomically enforces a 128 MiB retained-source BLOB quota and searchable-corpus limits of 20,000 chunks and 20 million characters. Exact duplicate submissions return the existing job without consuming capacity twice.
- PDF parsing runs in a disposable child process with at most two PDF workers across all workspaces in one API process. A request waits at most two seconds for a worker within a 15-second total wall-clock deadline. Output is bounded and the child receives a restricted environment and kill/reap handling. On POSIX, the child also receives 512 MiB address-space, 10-second CPU, file-size, file-descriptor, and core-dump limits. This is process resource containment, not a filesystem or network sandbox. Windows enforces the deadline and IPC bounds but has no OS memory cap.
- The six workspace databases and bounded worker queues are designed for one backend process and one instance. In-memory rate limits are local guardrails, not distributed abuse protection.

## Release gates still open

- [ ] Choose and configure the hosting arrangement for the frontend, backend, and durable backend data volume. The app has not been deployed publicly; HTTPS and production secret injection are not verified.
- [ ] Provision the single owner editor account and a unique session secret. Verify the production login, deep-link return, workspace access, and session-expiry recovery against the hosted configuration.
- [ ] Configure an HTTPS origin, edge request/rate limits, and the fixed reachable HTTPS backend URL for the frontend proxy. Confirm secrets stay server-side.
- [ ] Verify proxy deadlines/configuration errors are bounded and visible, and that polling backs off on rate limits and honors `Retry-After` in the hosted configuration.
- [ ] Set a backup cadence and retention policy for all six SQLite files. Run and record a restore drill from backups, including checking the restored app starts and serves data.
- [ ] Run a hosted load check against representative data and owner workflows. Confirm storage capacity, response times, queue behavior, and the single-instance limit are acceptable.
- [ ] Review representative course sources and relevance/answerability judgments. Retrieval currently uses untrained heuristics; no model candidate is promoted. Establish quality acceptance criteria before relying on it for course answers.
- [ ] Run hosted verification after choosing a host and record the results. Local code checks are complete as recorded below; hosted behavior, HTTPS, and load remain unverified.

## Verification record

- Workspace: local project checkout; no Git repository was available, so there is no commit, remote CI result, or PR to reference.
- Backend suite: **134 passed** in 58.21 seconds; frontend suite: **53 passed**; lint, typecheck, and production build: **passed** (2026-11-13, parent-run).
- Browser PDF upload: passed using the isolated parser; produced one chunk with page 1 provenance and the expected blank-page-2 OCR warning.
- Browser owner flow: deep `/retrieval` sign-in retained the URL; sign-out hid the result; signing in again and restarting the backend preserved graph version `graph-sqlite-1`, the path, and source evidence.
- Browser navigation after the fallback rebuild: actual clicks moved from saved PDF chunks to `/graph?document=…`, built the graph, opened `/retrieval`, returned a cited answer from `parser-verification.pdf`, and opened `/explainability?result=…` with citations and path for graph version `graph-sqlite-2`. All clicks passed with zero console errors.
- The fallback was rechecked in the production build; lint and typecheck passed again. It performs full-page browser navigation by design because beta Vinext dynamic module exports broke `next/link` prefetch and client navigation. All nine `next/link` imports were removed in favor of the shared `AppLink` wrapper.
- These local results do not establish hosted behavior or load capacity.
- Resource-limit validation ran on Windows with POSIX limits mocked; no native Linux execution has confirmed those OS limits.
- Public deployment, HTTPS checks, scheduled backups, restore drill, and hosted load check: **not run**.
- Course quality review and retrieval acceptance decision: **not complete**.

See [operations](OPERATIONS.md) for configuration and runbook details, [backend setup](../backend/README.md) for limits, and [evaluation plan](EVALUATION_PLAN.md) for quality evaluation context.

## Local target update — 2026-11-14

The current intended product is a private, one-owner app on a Windows laptop. Do not deploy or configure hosting for this target. Use `Start-SoftGraph.cmd`; records stay in local SQLite workspaces. The current focused scope is hospital records, separate educational soft-computing assessments, and the consolidated Syllabus registry in Learning lab. This local workflow supersedes the hosting, public HTTPS, and cloud-load gates above.

The 2026-11-14 local implementation passed **265 backend tests**, **54 frontend tests**, full oxlint, and TypeScript checks (backend test database isolated under `output/verification/nov14-final`). Windows production-launcher and browser verification also passed. The earlier 2026-11-13 verification record above documents the prior product surface; see the [2026-11-14 local verification record](LOCAL_VERIFICATION_2026-11-14.md) for the current evidence and limits. See [Local use](LOCAL_USE.md), [Hospital records](HOSPITAL_RECORDS.md), and [Local operations](OPERATIONS.md) for current instructions.
