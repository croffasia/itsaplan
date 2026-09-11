# The Plane import feature

What actually shipped for issue #253, and exactly where it falls short of the design that
was posted there. `docs/dev/plane-import-source-notes.md` covers Plane's own API wire
format; this file covers the feature built on top of it. Read both before extending this —
this one for what the code does and does not do, that one for what Plane's API actually
returns.

## Shape

- `packages/db/src/schema/app.ts` — `import_job` (one row per run, `status`/`attempts`/
  `next_attempt_at`/`last_error` the same shape as `webhook_delivery`, credential columns
  encrypted the same way as `integration_credential`) and `import_record` (source id →
  local id mapping, the idempotency and resume primitive).
- `apps/worker/src/{canonical,reader,plane-adapter,import-store,import-worker}.ts` — the
  `SourceReader` port, the only implementation (Plane), and the phase state machine
  (discover → create → link → rewrite → attachments → done) that drives a job one bounded chunk per
  tick.
- `apps/api/src/modules/import-jobs/` — create/test-connection/plane-preview/export/status/
  pause/resume/cancel routes.
- `apps/web/src/features/settings/components/import-export/` — the Settings page.

## Export: a JSON snapshot, not a live sync

`apps/api/src/modules/import-jobs/export.ts` (`GET /projects/:projectKey/import-jobs/export`,
gated the same as starting an import) reads a project's states, labels, cycles, and issues
(with their comments and relations) directly via `@repo/db` and shapes them into a
self-contained, human-readable JSON document — issues, parents, and relation targets are
referenced by their own identifier (`"MKT-42"`), not a database id, so the file reads
sensibly opened on its own. `SettingsImportExportDownloadButton.tsx` fetches it and saves it
client-side with the same blob + `createObjectURL` pattern `DocumentExportDialog` already
uses for documents.

This is deliberately a download, not a live write-back into Plane or anywhere else: there is
no write-capable adapter, no export job phase, and no target-specific format. Building a
live sync into a specific target (starting with Plane, since that is the one adapter that
exists) is a separate, much larger piece of work — a `PlaneWriter` mirroring `PlaneReader`,
handling Plane's own id assignment and rate limits on the way out — deferred, not started.

## Mapping review, parent links, and cross-references

Originally all missing against the design posted to #253; now built:

- **Mapping review.** Picking a source project (`SettingsImportExportProjectPicker.tsx`) no
  longer starts the job directly — `SettingsImportExportMappingReview.tsx` fetches the
  source project's states from the new `POST /projects/:projectKey/import-jobs/plane-preview`
  route (`testPlaneStatesPreview`, `apps/api/src/modules/import-jobs/service.ts`) and shows
  each one with the category itsaplan would automatically map it to, editable before the job
  is created. Only a row the user actually changes is sent as a `stateOverrides` entry;
  `materializeStates` (`import-worker.ts`) resolves `overrides[state.sourceId] ?? state.
  category` before calling `createLocalStateAndRecord`, so an override only ever affects a
  newly-created column, never a dedup-matched existing one. `unmatchedUserPolicy: 'skip'`
  drops a comment whose author matched no project member instead of creating it
  unattributed; an issue's own assignee is unaffected either way, since an unmatched
  assignee already left the field empty by default.

Parent links and cross-references each get the same second-pass treatment relations
already had via `runLink`:

- **Parent/sub-issue links.** `createOneIssue` still sets `parentId` from whatever
  `import_record` says at that moment, which misses a sub-issue processed before its
  parent exists. `runLink` (`import-worker.ts`) now re-fetches every created issue a
  second time (it already does this for relations) and calls
  `setIssueParentIfUnset` (`import-store.ts`) once the parent resolves. Idempotent: the
  `parent_id IS NULL` guard makes a retry a no-op and never overwrites a parent Create
  already set correctly.
- **Cross-references in text.** A new `rewrite` phase runs between Link and Attachments.
  `import_record.source_display_id` carries Plane's own `sequence_id` for every imported
  issue (stashed at Create time, from `CanonicalIssue.sequenceId`); the job's `config.
  planeProjectKey` (the source project's Plane identifier, e.g. `"ROOMS"`, stored at job
  creation) is what a mention has to start with. For every created issue, its description
  and every comment on it are scanned for `<planeProjectKey>-<number>` and rewritten to
  this project's own identifier when the referenced number was itself imported into this
  job; an unresolvable mention (outside the imported set) is left exactly as it was. The
  matching and substitution logic is pure and unit-tested in `cross-reference.ts`
  (`extractCrossReferences`/`applyCrossReferenceReplacements`) — no database, no network.
  A job created before this phase existed has no `planeProjectKey`, and Rewrite is a
  no-op for it rather than a failure.

## Other real limitations, by design or by scope, not oversights

- **Attachment bytes are never fetched, and neither is the filename.** `createOneIssue`
  calls `reader.listIssueAttachments(sourceId)` only to pass `attachments.map(a =>
  a.sourceId)` into `insertDiscoveredIds` (`import-worker.ts:261-268`) — the filename and
  content type Plane returns are read and discarded. No `issue_attachment` row is ever
  created. The Attachments phase (`runAttachments`) does nothing but close the job out.
  `counts.attachment.created` will read 0 for every job, forever, by design — the UI shows
  this honestly rather than hiding the column.
- **Custom fields, modules, milestones, work item types**: not read from Plane at all.
  `CanonicalIssue.customFields` exists as a type but `plane-adapter.ts` hardcodes it to `[]`
  (see the source notes file's "Custom properties" section for why — no project-wide list
  endpoint, and the endpoint 404s on some self-hosted versions).
- **Four of Plane's eight relation kinds are dropped intentionally**: `RELATION_KIND_MAP`
  (`plane-adapter.ts`) has no entry for `start_before`/`start_after`/`finish_before`/
  `finish_after` — itsaplan's `issue_link.kind` has no scheduling-dependency concept, so
  these are filtered out, not a bug.
- **Re-running an import against the same source project reuses what a previous run already
  created, by name/content match, not by any record of which import created what.**
  `import_record` makes one job's own retries and resumes safe; across two separate jobs
  (a fresh job started after a cancel, or a second job against the same Plane project) it
  offers nothing, since each job starts its own `import_record` set. Instead,
  `createLocalStateAndRecord`/`createLocalCycleAndRecord`/`createLocalIssueAndRecord`/
  `createLocalComment` (`import-store.ts`) each look up existing content in the destination
  project first — a `project_column`/`cycle` by exact name, an `issue` by case- and
  whitespace-insensitive title, a comment by exact body and `createdAt` on the resolved
  issue — and reuse it instead of inserting a duplicate; `createLocalLabel` already did this
  via its own `(project_id, name)` unique constraint. A match is reused, never overwritten:
  an existing column's `stateType` is left as Plane's category disagrees with it, for
  instance. This is a content match, not provenance tracking, so it also matches content a
  user created by hand before importing, not only a previous import's output. `issue_link`
  needs no equivalent logic — its `(pair, kind)` unique index rejects the duplicate insert
  outright, caught by `isUniqueViolation` in `createIssueLink`.
  State/cycle name matching is exact (case-sensitive); issue title matching is not. Nothing
  currently makes the two consistent — worth revisiting if a Plane workspace turns out to
  use different casing than itsaplan's own default column names.
  Concurrent ticks racing this lookup-then-insert (two import jobs targeting the same
  project, processed by two different worker replicas at once) could still both miss the
  same not-yet-created match and insert twice — not addressed, since a self-hosted worker
  normally runs as one replica.
- **Whether archived Plane issues are silently excluded is unverified** — the default
  `work-items/` listing this adapter uses returned zero archived items in the one workspace
  checked during development, and the separate archived-items endpoint 404s on that same
  instance, so this could not be confirmed either way. See the source notes file.

## Rate limiting and resumability, working as designed

`rateLimitBackoffMs` (`plane-adapter.ts`) reads `x-ratelimit-remaining`/`x-ratelimit-reset`/
a 429 off every response; hitting the limit throws `PlaneRateLimitedError`, and
`handleTickError` (`import-worker.ts`) reschedules via `retryImportJobLater` rather than
counting it as a failed attempt. `import_job.last_error` is cleared the moment a claim starts
a new attempt, as well as on success and on completion (`import-store.ts`'s
`claimDueImportJobs`/`saveImportJobCursor`/`advanceImportJobPhase`/`completeImportJob`), so a
non-null `lastError` on a still-`pending` job reliably means "currently waiting out a retry,"
never "an attempt is in flight" — which is what the Settings page's warning banner reads.
Clearing it at claim time (not only on success) matters: without it, a poll landing while the
new attempt is still running would show the *previous* error next to the claim lease's own
deadline (up to `LEASE_SECONDS` out) as if that were the retry countdown — a real bug this
session found live, from a workspace large enough to retry several times in a row (the
countdown jumped from a real ~15s to a bogus ~118s). Verified live against a real workspace
during development: Create's per-issue
cost (`getIssue` + `listIssueComments` + `listIssueAttachments`, three requests) times
`ISSUES_PER_TICK = 15` fires 45 requests in one tick with no pacing between them, which
reliably exhausts Plane's ~60 req/min budget within the first tick or two of Create on any
project of real size. Safe (never exceeds the limit, always resumes), not throughput-optimal
— worth pacing requests within a tick rather than bursting, if import speed matters later.

Pausing and resuming while a job is mid-retry does not bypass the wait: pausing touches
neither `last_error` nor `next_attempt_at`, so `resumeImportJob` (`service.ts`) sees the same
values a live rate-limited job has and keeps the stored `next_attempt_at` rather than
resetting it to now — the external rate limit did not clear just because the job was paused,
so resuming into "now" regardless would have sent an immediate, still-doomed request and come
back rate-limited again right away with a new, unrelated countdown. Only a job paused for no
real reason (`last_error` null, or a stored deadline that already elapsed by itself) resumes
immediately. The Settings page's countdown also now ticks every second on its own
(`SettingsImportExportJobRow.tsx`) instead of only moving in the 2s jumps of the job list's
own poll.
