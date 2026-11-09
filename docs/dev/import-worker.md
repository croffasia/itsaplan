# Source imports in the worker

`import-worker.ts` polls `import_job` for a due `pending` row (`import-store.ts`,
same claim-with-lease shape as `webhook_delivery`) and advances it by one bounded
chunk of work per tick — a large import interleaves across many ticks rather than
running to completion in one.

- `canonical.ts` — the source-independent shape an adapter produces
  (`CanonicalIssue`, `CanonicalState`, ...). Plain types, no logic.
- `reader.ts` — the `SourceReader` port a source adapter implements, and the
  `SourceRateLimitedError` an adapter throws when the source's rate limit is
  reached.
- `import-sources.ts` — one entry per `import_job.source`: its credential and
  config types, how to build its reader, and its issue-key prefix for Rewrite. A
  new source needs an entry here and a `SourceReader` adapter; the phases do not
  change. It also needs a job type and routes in
  `apps/api/src/modules/import-export`, and a connect form with its strings in
  the web settings.
- `import-retry.ts` — what a failed tick does: a rate limit is waited out and
  does not count toward the attempt limit (the claim's bump is undone), a job whose
  source has no registry entry fails at once, any other error retries with backoff
  until `MAX_ATTEMPTS` in a row.
- `plane-adapter.ts` — the Plane implementation. HTTP against a Plane
  instance via `pinnedFetch`, using the credential decrypted from the job row
  (base URL, workspace slug, API key — never from env, since this has to work
  against any operator's self-hosted instance). `docs/dev/plane-import-source-notes.md`
  is the spec it follows for pagination, rate limiting, and Plane's actual wire
  shapes.
- `linear-adapter.ts` and `linear-mapping.ts` — the Linear implementation: its
  GraphQL API at the fixed `https://api.linear.app/graphql` with the job's
  personal API key, and the pure mapping from Linear's shapes. Issues in
  Linear's trash are left out. Files uploaded into Linear text are attachments;
  `resolveAttachmentDownload` follows `uploads.linear.app`'s redirects itself
  and sends the key to that host only. `docs/dev/linear-import.md` has the
  queries, limits and mapping.
- `trello-adapter.ts` and `trello-mapping.ts` — the Trello implementation: its
  REST API at the fixed `https://api.trello.com/1` with the job's API key and
  token, and the pure mapping from Trello's shapes. Lists become states, cards
  issues with their checklists and custom field values; the board's members
  reach the job already matched with project members' emails.
  `docs/dev/trello-import.md` has the requests, limits and mapping.
- `cross-reference.ts` — pure text matching for a source's own "KEY-123"-style
  issue identifier: no `@repo/db`, no network, unit-tested directly. What
  the Rewrite phase resolves into itsaplan's own issue ids.
- `import-store.ts` — all `@repo/db` access for imports: claiming due jobs,
  reading/writing a job's phase/cursor/status, the `import_record`
  source-id-to-local-id upsert, and creating the local rows (states, labels,
  cycles, custom fields, issues, checklists, comments, watchers, issue links)
  an import produces.
- `import-worker.ts` — the phase state machine. Discover snapshots every
  source id up front (`import_record` rows with no local id yet) before Create
  begins, rather than treating the source's own pagination cursor as the
  resumability anchor across the whole job — see the notes file's "Pagination"
  section for why. Create/Link/Rewrite resume from `import_record`'s own id,
  not the source's cursor. Link also gives every issue's parent link a second
  chance to resolve, the same way it already does for relations. Rewrite scans
  every created issue's description and comments for a mention of the
  source's own identifier and rewrites it to this project's, purely from
  already-local data — it makes no further requests to the source. An issue's
  mention of itself stays as written (the Linear footer relies on it), and so
  does an identifier that is a segment of a URL path.
- The Attachments phase re-lists each issue's attachments (metadata alone,
  captured during Create, is not reused — a download needs a fresh resolve of
  the two-hop, hour-lived URL right before it happens) and downloads the
  bytes it hasn't already created a local row for. Size and mime type are
  checked against the instance's own upload settings (`@repo/db`'s
  `getStorageSettings`/`mimeAllowed`) before the request; the project's
  storage quota (`@repo/db`'s `projectStoredBytes`, `@repo/storage`'s
  `putObject`/`attachmentObjectKey`) is checked before the upload and once
  more inside the same advisory lock (`lockAttachmentStorage`) an interactive
  upload takes, so the two never both pass a check that only one of them can
  actually fit. A download that answers anything but 2xx (an error page, a
  redirect) is refused before its body is read, and one that runs past the
  size limit is cut off there (`attachment-download.ts`): Linear reports no
  size, so that is its only size check. A rejected attachment
  (`AttachmentRejectedError`: size, type, quota, or a refusal from the file
  host) is logged and skipped. Any other error fails the tick, including an
  SSRF refusal (`UrlNotAllowedError`), a network error and a Plane resolve
  failure. The cursor is saved after the whole chunk, so the next tick repeats
  that chunk, and `MAX_ATTEMPTS` failed ticks in a row fail the job.
