# Plane as an import source

Ground-truth notes for the Plane `SourceReader` adapter (see issue #253). Every fact below
either comes from reading the Plane Python SDK's own source (the wire contract, not its docs)
or from a real authenticated call against a live self-hosted instance (one real workspace, one
real project — "Rooms" / `ROOMS`, 488 work items, 66 labels, 30 modules, 3 cycles, 16 members).
Facts still resting on the SDK read alone, not yet confirmed against a live response, are marked
**unverified**.

Where this came from: the `plane` MCP server (`plane-mcp-server`, run via `uvx`) depends on a
`plane` PyPI package that is a thin REST client. Both are cached locally after `uvx` installs
them (paths below) — this is not a project dependency, just where the source was read.

| What                          | Where                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| MCP server (`plane_mcp`)       | `~/.cache/uv/archive-v0/LcFRqvyWGcEPmXRW/plane_mcp/` (`plane-mcp-server` 0.3.1)            |
| REST client (`plane`)          | `~/.cache/uv/archive-v0/PeLyjVcN9KmZTRLB/plane/`                                           |
| Base HTTP plumbing             | `plane/api/base_resource.py`, `plane/config.py`                                            |
| Work item endpoints            | `plane/api/work_items/base.py`, `.../attachments.py`, `.../relations.py`                   |
| Response/request shapes        | `plane/models/work_items.py`, `.../pagination.py`, `.../query_params.py`, `.../enums.py`   |

## Base URL and auth

`{base_url}/api/v1/workspaces/{slug}/...`. `PLANE_BASE_URL` defaults to `https://api.plane.so`
for the SaaS product; a self-hosted instance sets it to its own origin. Auth is `X-Api-Key:
<token>` (a workspace/personal API key, not OAuth) — confirmed both in the SDK's header-building
code and live. No workspace-slug header is needed once it's in the path.

## Pagination — cursor is position-based, not a keyset

Confirmed live on `GET /workspaces/{slug}/projects/`:

```json
{ "total_count": 6, "next_cursor": "10:1:0", "prev_cursor": "10:-1:1",
  "next_page_results": false, "count": 6, "total_pages": 1, "results": [...] }
```

The cursor is a literal `"{per_page}:{page}:{offset}"` string (the SDK's own docstring says so
verbatim), not an opaque keyset token. This means resuming an import from a stored cursor is
**not safe** if the underlying result set shifted between the crash and the resume — an issue
edited, created, or moved mid-migration can shift every subsequent page by one, silently
skipping or duplicating rows on resume.

**Design consequence:** the Discover phase should do a full, fast pass that snapshots the
complete list of source ids up front (write them to `import_record` immediately), rather than
treating Plane's pagination cursor as the resumability anchor for the slower Create phase.
`import_job.cursor` should track *our own* position in that snapshot list, not Plane's cursor.

**Confirmed the hard way**: reconstructing the cursor yourself (e.g. a loop counter formatted
as `"{per_page}:{page}:{offset}"`) instead of passing back the exact `next_cursor` string the
server returned silently drops results — a real attempt at this fetched 388 of 488 real work
items with **no error of any kind**, because the server's own page-numbering convention doesn't
match a naive incrementing counter. Refetching correctly (chaining the literal `next_cursor`
value each time, stopping only when `next_page_results` is `false`) got all 488, no gaps, no
duplicates. **The adapter must treat the cursor as fully opaque** — store and pass back exactly
what the server returned, never construct or predict one, even though its format happens to be
readable.

`next_page_results: false` is the correct loop-termination signal (not "cursor equals the
previous one" or "fewer than `per_page` results came back" — page 4 above returned 88 items
with `next_page_results: false` and page 3 returned exactly 100 with `next_page_results: true`,
so result count alone doesn't tell you whether you're done).

## Rate limiting — and what it actually costs

Confirmed live — every response, including plain reads, carries real headers:

```
x-ratelimit-remaining: 59
x-ratelimit-reset: 1788234260
```

`x-ratelimit-remaining` visibly ticks down one per request, two consecutive calls a second
apart showed resets 95 seconds apart — consistent with roughly **60 requests/minute**, not a
generous ceiling. So self-hosted Plane does enforce and report a rate limit, not just the SaaS
product. The SDK's `RetryConfig` retries `429, 500, 502, 503, 504` (`total=3,
backoff_factor=0.3`) and sets `respect_retry_after_header=True` on the underlying
`urllib3.Retry`. **Still unverified**: no 429 was actually triggered during exploration, so
whether a real `Retry-After` header shows up on the throttled response itself (as opposed to
just the two headers above on a normal 200) is still open — the adapter should handle both:
back off on `x-ratelimit-remaining: 0`, and respect `Retry-After` if a 429 ever carries one.

**This is the actual constraint on the whole design, not a background concern.** `relations`,
`comments`, and `attachments` are each a separate per-work-item endpoint — confirmed below,
`expand` does not fold them into the list page. For this one project: 488 work items × 3 calls
≈ 1,460 requests, plus ~5 list pages, at ~60/min — **roughly 25 minutes of pure API waiting for
one medium-sized project**, before a single byte of an actual attachment downloads. A
Jira-scale migration is hours, not minutes. Consequences:

- This closes the case against a synchronous or chat-turn import even more directly than the
  credential argument already did — there is no way to do this within one request/response
  cycle for a project of any real size.
- The progress view needs to communicate pace honestly (e.g. "1,204 of 1,460 API calls made,
  ~4 min remaining at current rate"), not just a raw item count — a bar sitting at 40/488 for
  ten minutes reads as hung, when it's actually on schedule.
- It makes `expand` (below) worth checking for every entity, since folding N calls into 1
  wherever it works is the single highest-leverage optimization available.

## `expand` — folds in relational fields, not related collections

Confirmed live: `GET .../work-items/?expand=assignees,labels,state` returns `assignees` and
`labels` as full objects (name, email, color, etc.) instead of bare UUIDs, and `state` as
`{id, name, color, group}` instead of a bare UUID — collapsing what would otherwise be separate
member/label/state lookups per issue into the one list call already being made.

**Confirmed it does NOT extend to relations, comments, or attachments**: requesting
`expand=relations,attachments,comments` on the list endpoint returns the exact same key set as
no `expand` at all — those three stay separate per-work-item endpoints with no bulk variant.
`expand` folds in *fields on the work item itself*, not *related collections*. So the
1,460-call estimate above is not avoidable by a smarter query — those calls are real.

## Descriptions

A work item carries three description representations at once:

- `description_html` — HTML. This is the one to convert to markdown for the canonical format.
  Confirmed live: real content uses Tiptap-flavored markup, e.g.
  `<p class="editor-paragraph-block" data-id="...">`, not plain semantic HTML. A markdown
  converter needs testing against real checklist/code/mention blocks, not just paragraphs —
  none of those appeared in the one issue pulled so far.
- `description_stripped` — declared in the model, but **confirmed absent as a key** on both the
  list and the retrieve response for a real issue. Not null — genuinely not sent. Don't rely on
  it; derive plain text from `description_html` instead if it's ever needed.
- `description_binary` — present as a key, looks like a CRDT snapshot (Yjs/Automerge) for
  collaborative editing, not a document format; ignore it for import.
- `description` (raw, richer) only appears on the `?expand=` variant (`WorkItemExpand`) per the
  model; not tried live.

`description_html` is confirmed populated on both `list` and `retrieve` (3291 chars on a real
issue via `retrieve`; list results also carried non-empty `description_html`) — no need for an
extra per-issue call just to get the body, the list page already has it.

## Attachments — two-hop, and the URL expires in exactly an hour

`WorkItemAttachment.asset` is an id-like string, not a URL, but the list response already
carries `attributes: {name, size, type}` and a duplicate `storage_metadata` block — enough to
render the review/preview step without ever resolving a download URL. Getting actual bytes is
two requests:

1. `GET .../work-items/{id}/attachments/{attachment_id}/` with the Plane auth header, **not
   following redirects**.
2. Confirmed live: a `302` whose `Location` is an S3 URL with `X-Amz-Expires=3600` — exactly one
   hour, not "typically" — needing no Plane auth at all.

**Design consequence:** `CanonicalAttachment` must carry a stable reference (attachment id +
parent work item id), never a resolved URL — the Attachments phase runs after Create/Link and
may execute long after Discover, well past an hour later. The adapter re-resolves the redirect
at the moment it actually downloads, not before.

**Inline images in descriptions are a second, separate attachment path.** Tiptap editors can
embed an image directly in the body (an `<img>` pointing at a Plane asset URL), not just as a
separate attachment row. Checked live across 50 real issues: **zero** had an inline `<img>` in
`description_html` — this team attaches screenshots as separate files rather than pasting them
inline. That is this workspace's habit, not proof Plane's editor can't do it. If a source
project does embed images inline, they'd render as broken images pointing at a host the new
instance can't necessarily reach, unless the Attachments phase also parses description HTML for
embedded asset references, downloads and re-uploads those too, and rewrites the HTML before
conversion to markdown. That means description handling can't be a pure function that finishes
during Create — it may need a pass revisited during Attachments. Not yet designed; flagged here
so it isn't discovered mid-implementation.

## Comments — not yet placed in the phase design

`GET .../work-items/{id}/comments/` is a real, working, unpaginated array endpoint
(`comment_html`, `comment_stripped`, `created_by`, `created_at`, ...) — the one work item
checked here had zero comments, so its shape wasn't fully exercised, but the endpoint itself is
confirmed live. **The phase list posted to #253 (Discover → Create → Link → Attachments → Done)
has nowhere for comments to go.** They need either their own phase (most likely between Create
and Link, since a comment can itself contain a cross-reference needing the same second-pass
resolution as description text) or an explicit decision that comments don't migrate in v1 — but
right now the design implies neither, silently. Comments also carry `created_by`, which needs
the same unmatched-user policy as `assignees` do. On a 488-issue project, comments plausibly
outnumber issues — this isn't a minor omission to patch in later.

## Idempotency vs. re-run — resume and re-run are different problems

`import_record` (source id → local id, keyed per job) solves *resume*: a crashed job picks up
where it left off without duplicating. It does not solve *re-run*: if someone imports, doesn't
like the state/user mapping, and runs a fresh import against the same source project, nothing
currently stops that from creating 976 issues instead of updating the original 488. Plane's own
`external_id`/`external_source` fields — present on `WorkItem`, `WorkItemComment`, and
`WorkItemAttachment` already, confirmed in the models — exist for exactly this kind of
cross-system dedup. Whether itsaplan's own tables need an equivalent persisted reference (a
migration, not just the job-scoped `import_record`) is an open product/schema decision, not
something to default silently — the maintainer should weigh in given it's a real schema change
beyond what's already proposed.

## Version skew is broader than one endpoint

The work-item-types 404 already noted below is not an isolated quirk. On this same instance,
also confirmed 404: `archived-work-items/` (the exact path `list_archived` in the SDK uses) and
`work-items/count/` (workspace-level). And confirmed absent everywhere: no export-shaped
endpoint at all (see below). Three-for-three 404s on endpoints the SDK's source code documents
as real is enough to treat this as a general fact about self-hosted deployments, not a fluke:
**a meaningful fraction of the officially-documented API surface may not exist on any given
self-hosted instance**, likely because the operator is running an older release.

**Design consequence:** the Connect step should do more than validate a token. After "Test
connection" succeeds, probe the optional endpoints (work item types, custom properties,
archived items, modules, count) and report back what this instance can actually supply —
"Connected. Issues, states, labels, members, cycles available. Work item types and custom
properties not supported by this instance." — before the user ever reaches the mapping step.
That turns version skew into a fact stated up front, not a surprise discovered mid-import.

## Does Plane have its own whole-project export? No, confirmed closed

Worth checking before building a REST-walking adapter from scratch — if Plane can hand back a
full-fidelity dump of a project in one shot, that beats 1,460 individual calls. Checked two
ways:

- Grepped the entire SDK (`api/` and `models/`) for anything export-shaped — zero matches. The
  only "export"-adjacent thing in the SDK is `import-work-item-types` (a POST endpoint for
  importing *type definitions*, the reverse direction, not a project dump).
- Probed `export/`, `exports/`, `work-items/export/`, and a workspace-level `exports/` directly
  against the live instance — all four `404`.

Closed: no bulk export exists to lean on, at least not one the official SDK or this instance
exposes. Plane's own UI reportedly offers CSV/XLSX export for work items, which would be a
spreadsheet of rows losing relations, comments, attachments, and cycle membership — the same
shape (and the same limitations) as this app's own file importer (#228) already handles, not a
shortcut past it. The REST-walking approach isn't a fallback; it's the only path, and it's the
same machinery Linear and Jira will need anyway.

## Modules — 30 of them, real usage, a concrete answer rather than more investigation

Confirmed live: this project reports `total_modules: 30`. Itsaplan has no module-equivalent
table. Rather than treat this as an open question needing more API exploration, the workspace's
own data already implies the answer: this team already models secondary grouping through
prefixed labels (`"Page: API / Backend"`, `"Suggestion: Must Have"`). A `"Module: <name>"`
label is the same shape. Proposed: map each of a project's modules to a label named
`Module: <name>`, applied to every work item that belonged to that module, shown as its own row
in the mapping-review step (so it's a visible, opt-out-able choice, not a silent one) rather
than folded wordlessly into the does-not-migrate list.

## Relations vs. dependencies — two different concepts

`WorkItemRelationTypeEnum`: `blocking, blocked_by, duplicate, relates_to, start_before,
start_after, finish_before, finish_after`. Three map cleanly onto itsaplan's `issue_link.kind`:

| Plane                     | itsaplan `issue_link.kind` |
| ------------------------- | --------------------------- |
| `blocking` / `blocked_by` | `blocks` (one row, direction read both ways) |
| `duplicate`               | `duplicates`                 |
| `relates_to`               | `relates`                     |

The other four (`start_before/after`, `finish_before/after`) are Gantt-style scheduling
dependencies with no destination in itsaplan's schema at all — not a translation problem, an
absent concept. Add to the does-not-migrate list, or collapse to `relates` as a lossy
best-effort (undecided — see open questions).

There is also a separate **custom relation definitions** system
(`work_item_relation_definitions.py`, `CreateWorkItemCustomRelation`) — workspaces can define
their own named relation types beyond the eight built-in ones. **Unverified** whether this
workspace actually uses any; if it does, those have no destination in itsaplan either.

## Custom properties (`work_item_property`) vs itsaplan's `custom_field`

**Structural difference, confirmed live, bigger than the type-mapping table below**: Plane
scopes custom properties to a *work item type*, not to the project directly —
`.../projects/{id}/work-item-types/{type_id}/work-item-properties/`. There is no
"list every custom field in this project" endpoint; discovering them means first listing the
project's work item types, then listing properties per type. That's an N+1 fan-out the Discover
phase needs to account for, not a single call like states/labels/cycles.

**Also confirmed live**: on this self-hosted instance (this Plane version, this project, despite
`is_issue_type_enabled: true`), `GET .../work-item-types/` returns a real `404`, not an empty
list. The endpoint the SDK targets doesn't exist here — version/feature skew between the SDK
and a given self-hosted deployment is real, not hypothetical. **Design consequence:** custom
field and work-item-type discovery must be optional and degrade quietly (zero custom fields
found, not a failed import) when the source instance doesn't have the endpoint, rather than
treating a 404 here the same as a 404 on, say, work-items list.

`PropertyTypeEnum`: `TEXT, DATETIME, DECIMAL, BOOLEAN, OPTION, RELATION, URL, EMAIL, FILE,
FORMULA`.

| Plane        | itsaplan `custom_field.field_type` | Notes |
| ------------- | ------------------------------------ | ----- |
| `TEXT`        | `text`                                | direct |
| `DATETIME`    | `datetime`                            | direct (Plane has no separate plain `date`) |
| `DECIMAL`     | `number`                               | direct |
| `BOOLEAN`     | `boolean`                              | direct |
| `URL`         | `url`                                  | direct |
| `OPTION`      | `select` or `multi_select`            | depends on a multiple-values flag — **unverified**, need a real property definition |
| `RELATION`→USER | `member`                             | direct, if the relation target is a user |
| `RELATION`→ISSUE/RELEASE | — | no destination; drop or flatten to text |
| `EMAIL`       | —                                      | no destination; flatten to `text` (value survives, validation semantics don't) |
| `FILE`        | —                                      | no destination as a *field* (itsaplan attachments aren't field values); best-effort: store the file's name/URL as text, or drop |
| `FORMULA`     | —                                      | computed at Plane's layer; the formula itself can't migrate, only its last computed value could be snapshotted as read-only text |

## State categories — the category can't be trusted, confirmed on real data

`GroupEnum`: `backlog, unstarted, started, completed, cancelled, triage`. itsaplan's
`project_column.state_type`: `backlog, unstarted, started, completed, canceled`.

- Spelling: Plane uses `cancelled` (double L), itsaplan uses `canceled` (single L). A
  category-fallback mapping that does a naive string match will silently fail on every
  cancelled-category state unless this is normalized explicitly.
- `triage` has no itsaplan equivalent (itsaplan has no intake/triage concept at all). Falls
  back to `backlog`.
- **The real data makes the case for a mandatory review step, not just politeness.** This
  workspace's actual states include one named "In Progress" whose `group` is `backlog`, and one
  named "Cancled" (a typo in the display name) whose `group` is `completed`, not `cancelled`.
  Name-match-then-category-fallback, applied automatically with no review, would silently
  place both in the wrong local state. The mapping step in the UI design (states shown with an
  editable target, not auto-applied) exists because of exactly this — confirmed on a real
  workspace, not a hypothetical.

## Other real shapes worth knowing

- **Response envelope is not consistent across endpoints, and pattern-matching from a couple
  of confirmed cases is not a substitute for checking each one.** Only `members/` and a work
  item's `attachments/` are bare arrays. `labels/`, `states/`, `cycles/`, and a work item's
  `comments/` are the same `{total_count, next_cursor, ..., results: [...]}` envelope as
  `projects/`/`work-items/` — confirmed live after a real import failed immediately on
  `cycles/` assuming otherwise. A work item's `relations/` isn't a list at all: it's one array
  per relation kind, `{blocking: [...], blocked_by: [...], duplicate: [...], relates_to:
  [...], start_after: [...], ...}`, each holding the related work item's id directly, not
  `{relation_type, related_work_item}` rows. Every endpoint needs its own live check against a
  real response before an adapter relies on its shape.
- **Labels have a `parent` field** (nullable, self-referential UUID) — Plane supports real
  label hierarchies natively. Unused in this workspace (66 labels, all `parent: null`, using a
  `"Suggestion: X"` / `"Page: Y"` naming convention instead of the real hierarchy) but a source
  workspace that *does* use `parent` would need it mapped onto itsaplan's separate
  `label_group` table.
- **Members** (`GET .../members/`) return `{id, first_name, last_name, email, display_name,
  avatar, avatar_url}` directly, flat list, no pagination — exactly the shape needed for
  email-based user matching, no extra lookup required.
- **Cycles carry full timestamps, not dates** — `start_date`/`end_date` are
  `2026-08-20T13:19:13.714493+05:00`, not a plain date. itsaplan's `cycle.startDate`/`endDate`
  are date-only columns, so the time-of-day is dropped on import — lossy but harmless, worth
  one line in the PR description rather than a silent truncation nobody documented.

## What this workspace's real data shows

The one real project here (`Rooms`, identifier `ROOMS`, id `db95831f-b1ff-49e1-91c1-df28cd99bc41`)
reports `total_modules: 30` and `total_cycles: 3` (2 actual cycles returned) in its project
listing, plus 488 work items, 66 labels, 16 members. Modules are not a theoretical edge case for
this data — they're heavily used, more than cycles. Confirms modules need an explicit answer
(map to nothing, or best-effort as extra labels?) rather than a passing mention in the
does-not-migrate list.

## Archived and draft items — not proven absent, just not visible through this path

All 488 work items fetched via the default (correctly-paginated) list have `is_draft: false`
and `archived_at: null` — no drafts or archived items showed up. But `archived-work-items/`
404s on this instance (see version skew above), so there's no way, on this instance, to check
whether archived items exist but are simply invisible to the default list (which is exactly
what a separate `list_archived` method existing in the SDK implies should happen — archived
items are normally excluded from the default listing, not merged in with a flag). **Not
resolved**: whether a source project with real archived issues would have them silently
excluded from an import unless the adapter has some working way to reach them — worth checking
against a different Plane instance (or version) where the endpoint actually responds.

## Still open (not yet pulled)

- Whether `OPTION`-type custom properties distinguish single- vs multi-select, and what a real
  property/option definition looks like — blocked on the work-item-types 404 above; would need
  a different project or a newer instance to check.
- Whether this workspace uses Plane's custom relation-definitions system beyond the eight
  built-in relation types.
- A real 429 response's exact headers (only ever saw a normal 200 with remaining/reset).
- Milestones' actual field shape — not pulled (modules already resolved above).
- Linear (GraphQL cursor shape, attachment auth) and Jira (REST pagination token, ADF shape) —
  not started; same source-code-first approach applies once there's an SDK or OpenAPI spec to
  read for each.
