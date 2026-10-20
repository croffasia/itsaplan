# The Linear import source

How the Linear source plugs into the import pipeline described in
[plane-import.md](plane-import.md). The phases, resumability, de-duplication and rate-limit
handling are the same for every source; this file covers what is specific to Linear. The user
guide is [importing-from-linear.md](../importing-from-linear.md).

## Shape

- `apps/worker/src/linear-mapping.ts` — pure mapping from the GraphQL shapes to the canonical
  ones (states, labels, cycles, issues, comments, relations, uploads), unit-tested directly.
- `apps/worker/src/linear-adapter.ts` — `LinearReader`, the `SourceReader` for Linear: the
  queries, paging, the rate-limit check, and the upload download hops.
- `apps/worker/src/import-sources.ts` — the `linear` entry: credential `{ apiKey }`, config
  `{ teamId, teamKey, projectFilter: 'project' | 'none', projectId }`, and `teamKey` as the
  Rewrite prefix.
- `apps/api/src/modules/import-export/linear.ts` — the key check (teams with their projects),
  the states preview, and the Linear fields of `POST /import-jobs` (`source: 'linear'`).
- `apps/web/src/features/settings/components/import-export/SettingsImportExportLinear*.tsx` —
  the Linear tab; the mapping review is shared with Plane.

## Requests

Every request is a `POST` to the fixed `https://api.linear.app/graphql` through `pinnedFetch`,
with the personal API key as `Authorization: <key>` (no `Bearer`; an invalid key answers HTTP
401 with the GraphQL error code `AUTHENTICATION_ERROR`). No user-supplied URL is fetched.

| Reader method | Query |
|---|---|
| `listStates` | `team(id).states`, archived included |
| `listLabels` | `issueLabels` filtered to the team's labels and the workspace's (`team: { null: true }`), archived included; groups dropped, members named `Group/Name` |
| `listCycles` | `team(id).cycles`, archived included |
| `listIssues` | `issues(filter: { team, project: { id: { eq } } \| { null: true } }, includeArchived: true, orderBy: createdAt)`; an issue with `trashed` set (in Linear's trash) is dropped |
| `getIssue` | `issue(id)` |
| `listIssueRelations` | `issue(id).relations` — never `inverseRelations`, so each relation is read once, from the issue that owns it |
| `listIssueComments` | `issue(id).comments`, archived included, sorted oldest first |
| `listIssueAttachments` | the issue and its comments (the same two requests, cached for the tick), then the uploads found in their text |

Connections are read 50 at a time and paging stops only when `pageInfo.hasNextPage` is false.
An issue's nested labels and link attachments (archived ones included) are read as one page
of 50; when either reports `hasNextPage`, `assertComplete` throws an error naming the issue
("stopping to avoid a truncated import") rather than dropping the rest. One issue with its
labels and link attachments costs about 125
complexity points, so a page of 50 stays well inside Linear's 10,000-point limit for a single
query. A reader lives for one tick and caches the issue and comment reads of that tick, so the
Create step costs two requests per issue.

## Scope and source checks

`LinearReader` throws when the scope is `projectFilter: 'project'` without a `projectId`; the
API answers 400 for the same input when creating a job. A job whose `source` is not in the
registry fails at once with `UnsupportedImportSourceError`, with no retry.

## Rate limits

Linear answers a rate-limited request with HTTP 400 (sometimes 429) and the GraphQL error
code `RATELIMITED`. `linearRateLimitBackoffMs` turns that into `SourceRateLimitedError`, waiting
until the latest `X-RateLimit-*-Reset` (epoch milliseconds) of a budget whose `-Remaining`
is 0, capped at one hour (Linear's window), or one minute when no header says. The worker
reschedules the job for that reset time and records `last_error = 'rate limited'`. A rate
limit never fails the job by itself.

## Text

- Linear issue links (`https://linear.app/<workspace>/issue/ATO-12/<slug>`, bare, autolinked,
  or as a Markdown link) become the bare identifier `ATO-12`, so the Rewrite phase can resolve
  them; a rewritten URL would be a broken link.
- The description gets, in order: Linear's text, a `## Links` list of the link attachments
  that are not uploads, `Parent in Linear: <identifier>` when the parent is outside the job's
  team and project filter, and `Imported from Linear: <identifier>` last.
- An issue key directly after a `/` is not matched (`cross-reference.ts`), so a URL path is
  never rewritten.
- Rewrite leaves an issue's mention of itself as written (`rewriteCrossReferences` in
  `import-worker.ts`), which keeps the `Imported from Linear` line intact. A mention of an issue
  another job imported is left as written too, because `import_record` lookups are per job.

## Uploads

Files uploaded into Linear text live at `https://uploads.linear.app/...` and need the API key.
`extractLinearUploads` collects them from the description, then the comments, then link
attachments hosted there, first mention winning; a bare URL followed by sentence punctuation
(`.,;:!?`) is read without it. The attachment's source id is `"<issue id> <upload URL>"`, so
the same file referenced from two issues is attached to both.
Linear reports no size or type: the type comes from the file name (Bun's MIME table) and
`sizeBytes` is 0, so the size check is the download's own byte limit: a larger file stops
downloading there and is skipped (`ResponseTooLargeError` becomes `AttachmentRejectedError`).
Repeated names on one issue get ` (2)`, ` (3)` before the extension (skipping any name already
taken, compared case-insensitively), because the store reuses an attachment with the same
filename on the same issue.

`pinnedFetch` follows no redirect and `downloadAttachment` refuses anything but 2xx, so
`resolveAttachmentDownload` takes the hops itself: a `GET` that reads only the response head
(`maxBytes: 0, truncateBody: true`), up to three redirects, `https` only. The `Authorization`
header is sent only while the host is `uploads.linear.app`, never to the storage host a
redirect points at. A 2xx returns the final URL (with the key when that URL is still on
`uploads.linear.app`); a 429 is a rate limit; any other status, a redirect without a location,
or a fourth redirect is an `AttachmentRejectedError`, logged and skipped.

## Cycles

The store reuses a cycle by name within a project, so `mapLinearCycles` makes every name in a
list distinct, case-insensitively: an unnamed cycle is `Cycle <number>`, and a repeated name
becomes `<name> (Cycle <number>)`, then `<name> (Cycle <number>, 2)` and so on.
