---
name: security-audit
description: Find exploitable security vulnerabilities in this repository — access control, authentication, SSRF, injection, XSS, CSRF and open redirect, path traversal, secret exposure, AI agent and MCP abuse, backdoors in code, migrations, dependencies, and CI. Use when the user asks to audit code for vulnerabilities, check a feature or diff for security issues, or verify a reported advisory. With no argument it audits the current diff; with arguments, the named files, modules, or vulnerability classes.
---

# Security Audit

Find vulnerabilities a real actor can exploit. Report only confirmed ones.

## Rules

- A finding has an actor, a path from input to sink with `file:line`, and an impact. No path, no finding.
- Every claim comes from the current code. Locate places by search, never from memory or a fixed file list.
- A guard is missing only after you searched the route, its middleware, the shared helper, and the service it calls.
- Not findings: what `SECURITY.md` puts out of scope; chat-run agent traces readable by management and permitted members (by design).
- Proof is an integration test against the test database (`.env.test`), by the test rules in the app's `AGENTS.md`. Never the dev database or a live instance.
- Disclosure is private: report in chat, no public issue, PR, or commit. The proof test is committed only with the fix.
- Fix in the shared function every caller goes through, then search every sibling handler for the same mistake.

## Target

- Named files, modules, routes, or classes → those.
- Nothing named → the current diff (uncommitted, or the branch against `main`) plus every caller and sink it reaches.

## Actors

Severity follows the weakest actor that reaches the bug:

- anonymous visitor
- any signed-in account — owns the teams and projects it creates
- member with the default role; member with a custom role holding one permission
- revoked actor — removed member, disabled user, rotated or expired key, deleted share link
- holder of a non-cookie credential — API key, OAuth/MCP, SCIM, agent, runner, share, or invite token
- AI agent — acts on member-written text and fetched pages
- external system — webhook sender, git provider, Telegram, IdP, importer source, runner host
- contributor — author of a PR, a migration, or a dependency

## Method

For each entry point: actor → tenant (team, project) → every input (path, query, body including nested `*Id`, headers, cookies, files, rows another actor wrote, LLM output) → every sink (DB query, response, `fetch`, storage key, argv, `eval`, HTML, redirect, email, prompt) → the guard at that sink. Access control first.

## Vulnerability classes

Ordered by how often they appear in real advisories.

### 1. Access control

- Row read or changed by id without a team or project filter. Child object (attachment, comment, asset) not checked against its parent's project.
- Body id that moves an object or grants rights (`teamId`, `projectId`, `roleId`, `userId`, `ownerId`, `columnId`); a body spread into `.set(` or `.values(`.
- A second path without the main route's check: MCP or agent tool, bulk, import, export, copy, share link, socket, worker job, bot command.
- Escalation: invite or role grant above the caller's own rights, editing one's own role, removing the last owner.
- Revocation: sessions, API keys, OAuth tokens, sockets, webhooks, and scheduled runs still work after removal, disable, rotation, or password change.
- Header or context flag marking a request internal that a client can set. Authorization only in Next.js middleware. A check that fails open on error or `undefined`.

### 2. Authentication and credentials

- Non-cookie credential not hashed, not compared in constant time, not scoped to team and permissions, not expiring or revocable. A token accepted by an audience it was not issued for.
- OAuth/SSO: account linked by unverified email, missing `state` or PKCE, inexact `redirect_uri`, roles taken from IdP claims or SCIM beyond the admin mapping.
- Inbound signature not constant-time over the raw body, or without replay protection.
- One-time token (invite, reset, code) consumed by find-then-delete instead of one atomic update or delete.
- No rate limit on sign-in, OTP, reset, or token verification, or a limit key the client can rotate. Session issued before 2FA or email verification completes.

### 3. SSRF

- Outbound request to a URL from a user, a stored row, or provider metadata that bypasses `@repo/net` — `fetch`, SMTP, raw TCP.
- Fixed host with a path built from input (`owner/repo` containing `../`, `?`, `#`, `@`).
- Guard gaps: not connecting to the validated IP, redirects not re-validated, IPv4-mapped IPv6, NAT64, octal/hex/short IPv4, private, loopback, link-local, CGNAT, or multicast ranges.
- No size limit or timeout; raw upstream body or error returned to the caller.

### 4. Injection

- SQL: `sql.raw`, `sql.identifier`, a column, sort field, or JSON path from input.
- Code: `new Function`, `eval`, `vm`, dynamic `import()` with input; a validator compiled from a user-defined schema.
- Command: `spawn`, `exec`, `Bun.spawn` with input; `shell: true`; a `git` argument starting with `-`.
- Prototype pollution through a deep merge of a body or stored JSON. CRLF in email headers.

### 5. XSS and served content

- `dangerouslySetInnerHTML`, markdown or rich text without a sanitizer, `href`/`src` accepting `javascript:` or `data:`.
- Upload served inline from the app origin (SVG, HTML) without `Content-Disposition: attachment`, `nosniff`, and a server-chosen content type.
- User text in email or Telegram HTML without escaping.

### 6. CSRF, CORS, open redirect

- State-changing `GET`. CORS reflecting any origin with credentials. Wildcard trusted origin or `Origin: null` accepted.
- `callbackURL`, `redirect`, `returnTo`, `next` accepting `//host`, `/\host`, `https:host`, or encoded forms.

### 7. Path traversal and storage

- File path or storage key built from a filename or id: `..`, `/`, absolute, encoded forms; zip slip in imports.
- Download or presigned URL for a key the caller does not own.
- Next.js route that proxies to the API by request path: `..` or `%2e%2e` reaching other routes, cookies forwarded to another host.

### 8. Data and secret exposure

- Whole row returned: hashes, encrypted credentials, emails of non-members, another tenant's fields.
- Decrypted secret in a response, log, webhook payload, export, agent prompt, or error.
- Show-once secret (API key, webhook or invocation secret, invite token) returned again, or to a lower role.

### 9. AI agent, MCP, runner

- Agent tools allowed more than the member who started the run. Issue text, comments, attachments, and fetched pages are attacker input.
- Exfiltration through tools that fetch URLs, send webhooks, email, or messages, create public shares, or render markdown images.
- MCP tool with a weaker permission check than the REST route for the same action; a session id used as authentication.
- Runner: commands built from task text, files or env vars in uploaded traces, token scope. No cap on runs, steps, or tokens per run.

### 10. Limits and deployment

- One crafted request: unbounded page size, upload size, archive expansion, ReDoS. Request volume is out of scope.
- Compose, Helm, Dockerfiles: published DB or storage ports, default secrets.

### 11. Backdoors and supply chain

Ask what the change gives its author if the author is an attacker.

- Migrations (`packages/db/drizzle/*.sql`): rows that create users, sessions, API keys, members, or roles; `GRANT`, `CREATE ROLE`, `ALTER ROLE`; triggers and functions, `SECURITY DEFINER`; `COPY ... PROGRAM`, extensions such as `dblink`; SQL that does not match the schema change in `packages/db/src/schema`; an edit to an applied migration or to `meta/_journal.json`.
- Hidden path: a hardcoded id, email, token, or header value that skips a check; a debug or test bypass reachable in production; data sent to a hardcoded host.
- Weakened check: TLS or signature verification off, constant-time compare replaced by `==`, a widened regex or allowlist, `catch {}` around a check.
- Obfuscation: base64 or hex blobs, char-code arrays, string-built identifiers, dynamic `require`/`import`; non-ASCII in code — BiDi controls, homoglyphs (`rg -n '[^\x00-\x7F]'`).
- Install and build hooks: `preinstall`, `postinstall`, `prepare` in any `package.json`, `.husky`, Dockerfile steps that download and run a script.
- Dependencies: a new package (owner, age, typosquat); a lockfile change without a manifest change; a changed registry URL or integrity hash; git or tarball dependencies; `.npmrc` or `bunfig.toml` changes; a locked version with a published advisory that has a path here (`bun audit`).
- CI: `pull_request_target` or `workflow_run` checking out PR code, `${{ github.event.* }}` in `run:`, actions pinned to a tag instead of a commit SHA, new `permissions:` or secrets.
- Binary or opaque files without a reason: fixtures, archives, minified bundles, certificates, keys.

## Multi-agent search

A diff or a few files: audit alone. A larger target: fan out.

1. Read `AGENTS.md`, the `AGENTS.md` of every touched app and package, and `SECURITY.md`.
2. Spawn one read-only subagent per lane, all in one message. Drop lanes the target does not touch.

   | Lane | Classes | Surface |
   | --- | --- | --- |
   | access-api | 1 | api route modules, shared permission helpers, body → DB writes |
   | access-side | 1, 9 | MCP and agent tools, worker jobs, bot handlers, sockets, public/share/invite routes, Next.js server side |
   | auth | 2, 6 | better-auth config and plugins, credential checks, inbound webhooks, CORS, redirects |
   | outbound-files | 3, 5, 7 | outbound connections, uploads and storage, HTML rendering |
   | exec-data | 4, 8 | raw SQL, code and process execution, runner, decrypt calls and responses |
   | deploy | 10 | compose files, Helm chart, Dockerfiles |
   | backdoor | 11 | migrations, `package.json` files and lockfile, `.github/workflows`, binary files, the whole target for hidden paths and obfuscation |

3. Brief each subagent with: the target, its lane, and the instruction to read Rules, Actors, Method, and its classes from this file. It searches its surface itself, writes no tests or code, and reports nothing outside its classes. It returns candidates, strongest first: class, actor, path with `file:line`, impact, and where it searched for the guard. Nothing found → what it covered.
4. Verify every candidate yourself: re-read the cited lines and search for the guard that would refute it. Merge duplicates across lanes. For many candidates, give each group to a fresh subagent with the code and the instruction to refute, not the hunter's reasoning.
5. Write proof tests for confirmed findings, run variant analysis, report.

## Report

Print only the findings, most severe first.

```
<severity>  <class> — <title>
  Actor:  <weakest actor>
  Path:   <entry point> → … → <sink>  (<file>:<line>)
  Impact: <what the actor gets>
  Proof:  <test file and name> — <fails before the fix | not written, why>
  Fix:    <shared function to change, one sentence>
```

- critical — anonymous or any signed-in account reaches another tenant's data, takes over an account, or runs code on the server or runner host; any backdoor.
- high — a member exceeds their role, or a revoked actor keeps access.
- medium — needs a privileged actor or an unlikely precondition.
- low — limited impact, no data crosses a tenant.

No findings: `No exploitable findings` and what was audited.
