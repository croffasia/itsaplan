# App Documentation, Step 1: Shared Layer, Seed, Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `docs/modules/` with the module index, `mapping.md`, a seed script, a docs check script, and the `_shared/` documents for the web and API shared layers, backed by REA captures.

**Architecture:** Markdown documents under `docs/modules/`. One Bun script checks the documents against the repo (mapping coverage and referenced paths). One Bun script seeds the local instance over HTTP. REA captures the running web app with the seeded accounts and the evidence identifiers are recorded in the documents.

**Tech Stack:** Markdown, Bun scripts (plain TypeScript, no new dependencies), the `rea` MCP web capture tools, the local instance (Postgres 17 native, API `:3000`, web `:3001`).

**Spec:** `docs/superpowers/specs/2026-10-21-app-documentation-design.md`

## Global Constraints

- Language: English. All documents, comments and strings.
- Writing style: plain and literal, final state only, no metaphors (`AGENTS.md`).
- Agents do not commit: where a step says "propose commit", write a Conventional Commit message in chat and do not run `git commit` or `git push`.
- A module document starts with the commit hash of the code it describes (`git rev-parse --short HEAD`).
- Repo documents carry every fact on their own; REA evidence confirms them and is referenced by identifier.
- A claim not confirmed against the running app or the source goes under "Unconfirmed claims".
- Runtime is Bun. No dependency is added.
- Local instance: API `http://localhost:3000`, web `http://localhost:3001`, S3 uploads disabled.
- Seed accounts: one project owner and one member. The existing first account on the instance is the instance admin and is not touched.

## Review Focus

- Running the seed twice must leave the same data and exit 0 (accounts and project already exist).
- Sign-up may be refused or require email verification on this instance; the seed must fail with a message that names the cause, not a stack trace.
- A document that names a file path that does not exist; `check-docs.ts` fails on it.
- A web feature or API module that is in no mapping row, or a mapping row naming a folder that no longer exists.
- The member account sees fewer actions than the owner; captures of a permission-gated screen are taken with both accounts.

---

### Task 1: Index, mapping and docs check

**Files:**
- Create: `docs/modules/README.md`
- Create: `docs/modules/mapping.md`
- Create: `docs/modules/_shared/check-docs.ts`

**Interfaces:**
- Produces: `bun docs/modules/_shared/check-docs.ts` exits 0 and prints `OK` when every directory under `apps/web/src/features/*` and `apps/api/src/modules/*` (top level only) appears in a `mapping.md` row, every `mapping.md` row names an existing directory, and every backticked repo-relative path in `docs/modules/**/*.md` exists; otherwise exits 1 and prints each offender.
- Produces: `mapping.md` is a table with columns `Kind` (`web` or `api`), `Folder`, `Module`, `Step`. `Module` is the folder name under `docs/modules/` that documents it; `Step` is the number from the design's order of work.
- Consumed by: Tasks 2 to 5 run it as their final check.

- [ ] **Step 1: Write `check-docs.ts` with its self-check**

A function `check(root: string): string[]` returns the list of problems; the script prints them and sets the exit code. Add `docs/modules/_shared/check-docs.test.ts` with two cases using a temp directory: a folder missing from the mapping is reported, and a backticked path that does not exist is reported.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `bun test docs/modules/_shared/check-docs.test.ts`
Expected: FAIL, `check` not defined.

- [ ] **Step 3: Implement `check` in `docs/modules/_shared/check-docs.ts`**

Read directories with `node:fs`; parse `mapping.md` rows by splitting on `|`; extract paths with the regex for backticked strings that start with `apps/`, `packages/` or `docs/`.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `bun test docs/modules/_shared/check-docs.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `mapping.md`**

One row per web feature (22) and API module (42), generated from `ls apps/web/src/features apps/api/src/modules`. Assign `Module` and `Step` by dependency: dashboards (`apps/web/src/features/dashboards`, API `dashboards`, `charts`) is step 2; inbox (`inbox`, API `notifications`) is step 3; `work-items`, `issue`, API `issues`, `columns`, `views` is step 4; everything else is step 5. Rows that belong to the shared layer use `Module` = `_shared` and step 1.

- [ ] **Step 6: Write `README.md`**

An index table: module, step, status (`not started`, `documented`, `verified`), link. Step 1 modules start as `not started`. Include the commit hash the index was generated from.

- [ ] **Step 7: Run the check**

Run: `bun docs/modules/_shared/check-docs.ts`
Expected: `OK`, exit code 0.

- [ ] **Step 8: Propose commit** `docs: add module documentation index, mapping and check script`

### Task 2: Seed script

**Files:**
- Create: `docs/modules/_shared/seed/seed.ts`
- Create: `docs/modules/_shared/seed/README.md`

**Interfaces:**
- Produces: `bun docs/modules/_shared/seed/seed.ts` reads `API_URL` (default `http://localhost:3000`), creates or signs in the owner and member accounts, and creates one team and project with at least 12 issues across several statuses, 3 notifications for the member, and 1 dashboard with 2 charts. It prints a summary line per entity and exits 0. Accounts use `seed-owner@example.test` and `seed-member@example.test` with a fixed password constant in the file.
- Consumed by: Tasks 4 and 5 captures.

- [ ] **Step 1: Read how accounts and entities are created over HTTP**

Read `apps/api/src/__tests__/helpers/auth.ts` (`signUpTestUser`) for the sign-up request and cookie handling, and the controllers in `apps/api/src/modules/{projects,issues,members,dashboards,charts,notifications}/index.ts` for the routes and bodies. The seed uses `fetch`, not the in-process test app.

- [ ] **Step 2: Implement `seed.ts`**

Functions: `signUpOrSignIn(email: string): Promise<string>` returns the session cookie; `ensureProject(cookie: string): Promise<{ key: string }>`; `ensureIssues(cookie: string, projectKey: string): Promise<void>`; `ensureMember(ownerCookie: string, projectKey: string, memberEmail: string): Promise<void>`; `ensureDashboard(cookie: string, projectKey: string): Promise<void>`. Each `ensure*` is a no-op when the entity already exists (look up by name). A refused sign-up throws an `Error` whose message names the status and the response text.

- [ ] **Step 3: Run it twice**

Run: `bun docs/modules/_shared/seed/seed.ts && bun docs/modules/_shared/seed/seed.ts`
Expected: both exit 0; the second run prints "exists" for every entity and creates nothing.

- [ ] **Step 4: Confirm the data through the API**

Run: `curl -s -b <owner cookie> localhost:3000/<issues list route for the project>` and count the issues.
Expected: at least 12 issues; the member account lists the project too.

- [ ] **Step 5: Write `seed/README.md`**

How to run it, which accounts it creates, which entities, and that it is safe to re-run. Do not print the password in the README; point to the constant in `seed.ts`.

- [ ] **Step 6: Run the docs check**

Run: `bun docs/modules/_shared/check-docs.ts`
Expected: `OK`.

- [ ] **Step 7: Propose commit** `docs: add seed script for the local instance`

### Task 3: Web shared layer documents

**Files:**
- Create: `docs/modules/_shared/web-ui.md` (`components/ui`, `components/common`)
- Create: `docs/modules/_shared/web-shell.md` (`components/layout`, app shell routes in `apps/web/src/app/[teamRef]/(shell)`)
- Create: `docs/modules/_shared/web-data.md` (`lib/api`, `lib/api/endpoints`, TanStack Query setup in `components/providers.tsx`)
- Create: `docs/modules/_shared/web-auth-permissions-i18n.md` (`lib/auth-client`, `hooks/usePermissions.ts`, `apps/web/src/i18n`, `lib/dnd`)

**Interfaces:**
- Consumes: `mapping.md` from Task 1.
- Produces: each document follows the module template sections 1 to 9 of the design where they apply; sections that do not apply say so in one line. Each starts with the commit hash.

- [ ] **Step 1: Read the sources for one document at a time**

For each document, read the files it names and `apps/web/AGENTS.md`. Record, for `web-ui.md`: the shadcn components in `components/ui` (list from the directory) and each `common` component with its props; for `web-data.md`: the client factory in `lib/api/client.ts`, how `API_URL` reaches the client at runtime, and one table row per file in `lib/api/endpoints` with the domain it covers.

- [ ] **Step 2: Write each document**

Section 8 of each document ("Running it in isolation") lists the exact files a test repo copies, with the npm packages they import.

- [ ] **Step 3: Run the docs check**

Run: `bun docs/modules/_shared/check-docs.ts`
Expected: `OK`; every path named in the four documents exists.

- [ ] **Step 4: Propose commit** `docs: document the web shared layer`

### Task 4: API shared layer documents

**Files:**
- Create: `docs/modules/_shared/api-auth-permissions.md` (`apps/api/src/shared/{auth-context,access,guards,permissions,workspace-roles}.ts`, `packages/db/src/permissions.ts`, better-auth wiring in `packages/auth`)
- Create: `docs/modules/_shared/api-http-conventions.md` (`shared/{http,responses,pagination,schemas}.ts`, the module layout from `apps/api/AGENTS.md`)
- Create: `docs/modules/_shared/api-data.md` (`packages/db/src/schema/app.ts` structure, migrations, how tables are grouped)

**Interfaces:**
- Consumes: seed accounts from Task 2 to confirm permission behaviour.
- Produces: `api-auth-permissions.md` contains the permission matrix as a table (permission, roles that hold it) copied from `packages/db/src/permissions.ts`; `api-http-conventions.md` contains the error response shape and the pagination request and response shape, each confirmed with one `curl` against the running API; `api-data.md` lists the table names in `app.ts` grouped by area with the line range of each group.

- [ ] **Step 1: Read the sources and confirm the permission matrix**

Read the files above. Confirm one permission claim with each seed account: an action the owner can do and the member gets a 403 on.

- [ ] **Step 2: Confirm the error and pagination shapes**

Run one failing request (a 404) and one paged list request against the API with `curl`; copy the response bodies into the document.

- [ ] **Step 3: Write the three documents**

Table names come from `grep -n "pgTable(" packages/db/src/schema/app.ts`, not from memory.

- [ ] **Step 4: Run the docs check**

Run: `bun docs/modules/_shared/check-docs.ts`
Expected: `OK`.

- [ ] **Step 5: Propose commit** `docs: document the API shared layer`

### Task 5: REA captures and index update

**Files:**
- Create: `docs/modules/_shared/screens/*.png`
- Modify: `docs/modules/_shared/web-shell.md`, `docs/modules/_shared/web-ui.md`, `docs/modules/README.md`

**Interfaces:**
- Consumes: seed accounts (Task 2), the web documents (Task 3).
- Produces: REA evidence bundle identifiers recorded in the documents with the capture date; `README.md` rows for the `_shared` documents set to `documented`.

- [ ] **Step 1: Load the REA capture tools**

Run `ToolSearch` with `select:` for the `mcp__rea__` web tools named in the design (`capture_web_screenshot`, `observe_web_session`, `inspect_web_network_capture`, `trace_feature`, `export_evidence_bundle`) before calling them.

- [ ] **Step 2: Capture the shell as the owner and as the member**

Capture the login page, the shell after login (sidebar, header, command palette open) and one list page, for each account. Obtaining a signed-in browser session is left to the builder (a scenario with the login steps, or a cookie set before capture).
Expected: at least 4 screenshots and one network capture per account.

- [ ] **Step 3: Trace two actions to code**

Trace "open the command palette" and "change language" with `trace_feature` and record each result's endpoint and source file in `web-shell.md` and `web-auth-permissions-i18n.md`. A call that cannot be traced goes under "Unconfirmed claims".

- [ ] **Step 4: Export the evidence bundle**

Call `export_evidence_bundle`; write its identifier and the date in each `_shared` web document. Copy the screenshots into `docs/modules/_shared/screens/` and link them from the documents.

- [ ] **Step 5: Update the index and run the check**

Set the `_shared` rows in `README.md` to `documented`.
Run: `bun docs/modules/_shared/check-docs.ts`
Expected: `OK`.

- [ ] **Step 6: Propose commit** `docs: add REA captures for the shared layer`
