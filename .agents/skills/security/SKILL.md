---
name: security
description: Use when auditing code for security issues — a diff, a merge request, a file, a directory, or a feature. Checks the project's actual attack surface (access guards, SSRF, secrets, public routes, XSS) and prints a concise verdict report. Trigger when the user asks for a security review, a security audit, or before shipping a change that touches auth, permissions, webhooks, file downloads, or server-side fetches.
---

# Security Review

Three-stage method: produce findings, filter them, report verdict.

Stages 1 and 2 are internal reasoning. Never print them. Only the Stage 3 report reaches the user.

## Review target

- User named a target (file, directory, feature, commit range, MR) → audit that.
- No target named → audit the current diff (uncommitted changes, or the branch diff against the main branch).

## Stage 1 — Auditor

Audit the target. Collect findings.

### Audit algorithm (follow this order)

1. Read project rules — MANDATORY. Root AGENTS.md plus the nested AGENTS.md of every touched package (`apps/api`, `apps/web`, `packages/db`, …). Their Security sections name the invariants the codebase already holds.
2. Map the trust boundary — for a new route or feature: who can call it, what they can reach with it, what it writes or returns.
3. Trace one path end to end — request → guard → service → persistence or outbound call. A hole is where the guard ends and the code trusts what came in.
4. Check the report-worthy classes below — apply them to the reviewed code only, not pre-existing code.
5. Verify against source — re-read the cited lines. Drop findings referencing guards, routes, or behaviour that does not exist in the file. Never describe code from memory.

### Checks, by attack surface

**Access control (apps/api)**
- Every planner route enforces access through a guard in the route options (`permission`, `projectMember`, a macro), never an imperative call in the handler. A route with no guard is the finding.
- Entity-by-id routes resolve the project from the row itself (`getIssueProjectId` and siblings), not from a path or body value the caller supplies.
- Ownership rules act on the row's owner column (author, member who logged the entry). Another member's row is reachable only by a project owner.
- New MCP exposure (`...mcpTool(...)`) is deliberate, and the route still reaches `assertMcpAllowed` through its guard.
- `memberSelfOrAdmin` and `assertProjectAdmin` routes re-check grants on both sides of a flow (create and accept), the way the invite routes do.

**Input validation**
- All input validated with `t` schemas from the feature's `model.ts`; numeric path ids use `t.Numeric()` — never `Number(params.x)` in a handler.
- `t.Any()` jsonb is accepted only where the server stores and returns the blob without inspecting it.

**SSRF** — `packages/net`
- Any server-side `fetch` of a URL the caller supplies (webhooks, integrations, imports) goes through the SSRF guard in `@repo/net`. A raw `fetch(targetUrl)` on caller input is critical.

**Secrets**
- A secret at rest (integration credentials, tokens) is written through `@repo/crypto`, never stored plain.
- No secrets in code, comments, tests, or logs. A config value that must not reach the web bundle goes through `utils/runtimeEnv`, never `NEXT_PUBLIC_*`.
- Webhook signing secrets are server-generated (`generateSecret`); the user never supplies them.

**Public surface** — the routes that answer without a session
- `GET /attachments/:publicId/raw` keeps its defenses: `X-Content-Type-Options: nosniff`, the media allowlist, forced download outside it, the locked-down CSP. Weakening any of these is critical.
- Share links and public feeds disclose only what the share promises — no team data, no other issues.

**XSS and content injection (apps/web)**
- User-written markdown renders through the project's editor/renderer, which sanitizes. A new render path must use it too.
- No `dangerouslySetInnerHTML` on user input. User-written text gets `dir="auto"` so a right-to-left payload cannot scramble the layout.

**Error and data shape**
- Expected failures throw `HttpError` — never hand-built error bodies that could leak internals.
- Services return DTOs, never rows: a new response field is added by name, not by spreading a table row (which would ship every column it gains later).

### Do NOT check

Dependency CVEs (CodeQL and `codeql.yml` own that), code style, test coverage, performance.

### Finding fields

Track per finding, in your head, not printed at this stage:

- file and line
- title: short, one line
- problem: what is wrong and what an attacker gains
- fix: what to fix, one sentence
- severity: critical (confidence 90-100) = reachable hole (missing guard, SSRF, secret leak, XSS, public-route weakening). suggestion (confidence 80-89) = hardening gap with no working exploit shown
- source: one of `repository-rules` (AGENTS.md Security sections) or `general`

## Stage 2 — Filter

Act as a senior security reviewer. Keep ONLY findings that are:

1. **Exploitable or one step from it** — state who calls the route and what they get
2. **Actionable** — the developer understands what to fix
3. **High confidence** — verified against the source in step 5
4. **Critical severity** — NEVER drop a critical finding. Believe it is a false positive → downgrade to suggestion instead of removing

Remove: findings about pre-existing code, duplicates, findings that need several unlikely preconditions, style or hygiene notes with no security consequence.

Then pick a verdict: approve, request_changes (≥1 critical), or comment (only suggestions).

## Stage 3 — Console report

Do NOT edit, write, or fix any code. This skill only audits and reports.

Print the kept findings as plain text for a human reading a terminal. No preamble, no closing summary.

Format:

```
Verdict: <verdict> (<N> critical, <M> suggestions)
Audited: <what was audited>, <K> files

CRITICAL
  <file>:<line>  <title>  [<source>]
    <problem — who calls, what they gain>
    Fix: <fix>

SUGGESTIONS
  <file>:<line>  <title>  [<source>]
    <problem>
    Fix: <fix>
```

Example:

```
Verdict: request_changes (1 critical, 1 suggestion)
Audited: uncommitted changes, 4 files

CRITICAL
  apps/api/src/modules/issues/index.ts:1313  Comment route has no access guard
    PATCH /comments/:commentId reaches the service with no macro, so any session can rewrite any comment in any project.
    Fix: set the comment guard (owner or project owner) in the route options.
    [repository-rules]

SUGGESTIONS
  apps/api/src/modules/webhooks/service.ts:88  SSRF guard skipped on URL change
    updateWebhook stores a new url without re-validating it through @repo/net.
    Fix: validate url on update the same way createWebhook does.
    [general]
```

Rules:

- Critical first, then suggestions. Omit an empty section.
- No findings at all: print only `Verdict: approve (no issues found)` plus the `Audited:` line.
- One line per field. Problem and fix stay one sentence each. No payloads, no exploit walkthroughs, no tables.
