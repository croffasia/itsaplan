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
  (discover → create → link → attachments → done) that drives a job one bounded chunk per
  tick.
- `apps/api/src/modules/import-jobs/` — create/test-connection/status/pause/resume/cancel
  routes.
- `apps/web/src/features/settings/components/import-export/` — the Settings page.

## What is genuinely missing against the design posted to #253

The original interface sketch described a real mapping-review step and a two-pass design
that resolves parent links, relations, *and* cross-references in text. What shipped is
narrower than that in three specific ways, plus export was dropped entirely:

1. **No mapping review UI.** `createImportJobBody` (`apps/api/src/modules/import-jobs/
   model.ts`) still accepts `unmatchedUserPolicy` and `stateOverrides`, but
   `apps/worker/src/import-worker.ts`'s `buildReader` only ever reads `config.planeProjectId`
   — neither field is consumed anywhere in the worker, and the web UI never sends them
   (`SettingsImportExportProjectPicker.tsx`'s `createJob.mutateAsync` call omits both on
   purpose). State and user mapping is fully automatic, with no way to review or override it
   before a job runs. If this gets built, either wire the two existing fields up or remove
   them from the request body — right now they are dead API surface that looks like it does
   something.

2. **Parent/sub-issue links have no second pass.** `createOneIssue`
   (`import-worker.ts:217-269`) sets `parentId` from whatever `import_record` says *at that
   moment* (`findImportRecord(job.id, 'issue', canonical.parentSourceId)`), and nothing
   revisits it later. `runLink` (`import-worker.ts:311-329`) only handles
   `listIssueRelations` — parent linking is absent from it entirely. Since Create processes
   issues in `import_record`'s own id order (which mirrors Plane's pagination order, not a
   guaranteed parent-before-child order), a sub-issue processed before its parent exists
   gets created with `parentId: null`, permanently. Fixing this means giving parent links the
   same treatment relations already get: record the unresolved ones and revisit them in
   `runLink`, or run a dedicated pass after Create.

3. **Cross-references embedded in description/comment text are not touched.** `htmlToMarkdown`
   (`plane-adapter.ts`) converts markup only — a description that reads "see PROJ-123" comes
   through unchanged, still pointing at the source issue's identifier, not the new one here.
   Nothing rewrites this. This was called out as required in the original design and never
   implemented.

4. **Export does not exist.** Despite the page and branch being named "import-export," only
   the import direction was built. `CanonicalExport`-shaped output for round-tripping was
   part of the original design and was never started.

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
- **Re-running an import against the same source project is not idempotent across runs.**
  `import_record` makes one job's own retries and resumes safe, but a second job created
  against the same Plane project starts a fresh `import_record` set and will duplicate
  everything the first job already created. There is no cross-job dedup.
- **Whether archived Plane issues are silently excluded is unverified** — the default
  `work-items/` listing this adapter uses returned zero archived items in the one workspace
  checked during development, and the separate archived-items endpoint 404s on that same
  instance, so this could not be confirmed either way. See the source notes file.

## Rate limiting and resumability, working as designed

`rateLimitBackoffMs` (`plane-adapter.ts`) reads `x-ratelimit-remaining`/`x-ratelimit-reset`/
a 429 off every response; hitting the limit throws `PlaneRateLimitedError`, and
`handleTickError` (`import-worker.ts`) reschedules via `retryImportJobLater` rather than
counting it as a failed attempt. `import_job.last_error` is cleared on every successful tick
and on completion (`import-store.ts`), so a non-null `lastError` on a still-`pending` job
reliably means "currently waiting out a retry," which is what the Settings page's warning
banner reads. Verified live against a real workspace during development: Create's per-issue
cost (`getIssue` + `listIssueComments` + `listIssueAttachments`, three requests) times
`ISSUES_PER_TICK = 15` fires 45 requests in one tick with no pacing between them, which
reliably exhausts Plane's ~60 req/min budget within the first tick or two of Create on any
project of real size. Safe (never exceeds the limit, always resumes), not throughput-optimal
— worth pacing requests within a tick rather than bursting, if import speed matters later.
