# App documentation in the repo and in REA

## Intent

Document the whole itsaplan app module by module, so that any single module (for example
dashboards, inbox, or work items) can be rebuilt in a separate test repo without the rest of the
app. The documentation lives in two places that describe the same facts: markdown files in this
repo and evidence captured by REA from the running app.

The reason is reuse. The owner wants to take parts of itsaplan into other repos and test them in
isolation. Reading the code of a 12,000-line feature to find what it needs is slow. A per-module
document that lists the screens, endpoints, tables, permissions and shared code it depends on
removes that work.

## Goals

- Every web feature (22) and every API module (42) has a document that covers it.
- A document for a module has enough detail for a builder to recreate the module in a test repo
  that points at the same API, without reading the module's source first.
- The behaviour in each document is backed by a capture of the running app, not only by reading
  code.
- A shared-layer document exists first, because every module depends on it.
- Each module document is checked by building the module in a scratch repo from the document.

## Non-goals

- Documenting internals that no other repo would need (private helpers, test files).
- Changing application code. This project only adds documentation and captures.
- Documenting `apps/worker`, `apps/bot`, `packages/runner` beyond what a web or API module needs
  to reference. They are separate projects if wanted later.
- A published documentation site.

## Anti-goals

- Documentation that restates the code line by line. A document that cannot be used to rebuild
  the module faster than reading the source has failed.
- Documentation that drifts from the app. A claim that was not confirmed against the running app
  or the source is marked as unconfirmed.

## Constraints

- Language: English. `AGENTS.md` requires all code, comments and strings in English.
- Writing style: plain and literal, final state only, as `AGENTS.md` requires for docs.
- Agents do not commit. Files are written and a proposed commit message is given in chat.
- Runtime is Bun. The app runs locally without Docker: native Postgres 17 on `localhost:5432`,
  API on `:3000`, web on `:3001`, S3 uploads disabled. Captures run against this instance.
- REA is the MCP server `rea`. The tools used are the web capture and tracing tools
  (`capture_web_screenshot`, `observe_web_session`, `inspect_web_network_capture`,
  `trace_feature`, `export_evidence_bundle`).

## Structure

Repo documents, one folder per module:

```
docs/modules/
  README.md                index: every module, status, link
  mapping.md               maps each web feature and API module to a documented module
  _shared/                 shared layer, written first
    seed/                  script that fills the local instance with known data
  <module>/
    README.md              the module document
    screens/               screenshots captured through REA
```

`_shared/` covers `components/ui`, `components/common`, `lib/api`, permissions and
`usePermissions`, authentication client, i18n, drag and drop (`lib/dnd`), and the app shell and
layout components that modules render inside. It also covers the API side that every endpoint
depends on: auth middleware, the permission matrix in `@repo/db`, the error format, pagination,
migrations and the seed data. `_shared/` is complete before step 2 starts.

`mapping.md` is created during the survey in step 1. It lists the 22 web features and 42 API
modules and the documented module each belongs to, so that goal 1 can be checked. A module
document starts with the commit hash of the code it describes.

A module document has these sections, in this order:

1. Purpose: what the module does and for whom.
2. Routes and screens: each route, with a screenshot.
3. Components: the main components and what each renders.
4. API endpoints: method, path, request and response shape, and the web client file that calls
   it.
5. Database tables: the tables the endpoints read and write, with the columns the module uses.
6. Permissions: which permission or role gates each action.
7. Dependencies: shared code and other modules it imports.
8. Running it in isolation: what a test repo needs (API URL, auth, seed data) and what to copy.
9. Unconfirmed claims: statements not verified against the running app.

REA evidence: for each module, a captured session of the module in use (screenshots and network
traffic) and a trace from each main UI action to its endpoint and source file. The evidence bundle
stays in REA. The module document lists the bundle identifier and the capture date. The repo
documents carry every fact on their own: the endpoint list, request and response shapes and
screenshots are committed, so the module can be rebuilt if the REA store is lost. REA holds the
raw captures and is used to confirm the documents.

Captures use the seed data in `_shared/seed/`: one admin and one member account, and a project
with issues, notifications and a dashboard. Permission sections are confirmed with both accounts.
A claim that the local setup cannot exercise (attachments with S3 disabled, worker and bot
delivery) is marked unconfirmed in section 9.

## Order of work

Each step is its own plan and review cycle.

1. Shared layer.
2. Dashboards (`apps/web/src/features/dashboards`, API modules `dashboards` and `charts`).
3. Inbox (`apps/web/src/features/inbox`, API module `notifications`).
4. Work items with the issue detail, in three plans: the issue detail (`features/issue`, API
   module `issues`), the work-items lists and boards (`features/work-items`), and `columns` and
   `views`. Each gets its own folder; the issue detail may have sub-documents.
5. The remaining features and API modules, ordered by how many other modules depend on them.

Sizes from the first survey: dashboards 3,178 web lines and 771 API lines; inbox 980 web lines
and 1,347 API lines; work items 6,636 web lines; issue detail 12,279 web lines and 12,105 API
lines. Work items import `features/issue` 17 times, so they are documented together.

## Verification

For each module, a fresh agent builds a scratch repo outside this repo
(`~/Developer/itsaplan-sandbox/<module>`) from the module document, pointed at the local API.
The scratch repo may copy the files that section 8 lists from this repo; everything else is
written from the document. The module is done when the
rebuilt module renders and completes its main actions. A gap found while rebuilding goes back
into the document. Scratch repos are not committed here.

## Decisions made by the builder

- Documentation folder layout and the section order above.
- Screenshots are committed; evidence bundles are not, and are referenced by identifier. The
  repo documents are complete without REA.
- Scratch repos live outside this repo, are built by a fresh agent, and may copy listed files.
- Seed data, the API-side shared layer and `mapping.md` are part of step 1.
- Step 4 is split into three plans.
- Claims the local setup cannot exercise are marked unconfirmed instead of extending the
  environment.
- The order of the remaining modules in step 5.

## Left to the builder

- Exact capture scenarios for each module.
- How `_shared/` is split into files.
- Whether a module needs sub-documents, as `issue` probably does.
