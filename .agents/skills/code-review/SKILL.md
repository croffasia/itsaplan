---
name: code-review
description: Use when reviewing code — a diff, a merge request, a file, a directory, or a feature. Produces structured code-review findings, filters out false positives and nitpicks, and prints a concise verdict report. Trigger when the user asks to review a diff, review an MR, or check code for bugs, security issues, or rule violations.
---

# Code Review

Three-stage method: produce findings, filter them, report verdict.

Stages 1 and 2 are internal reasoning. Never print them. Only the Stage 3 report reaches the user.

## Review target

- User named a target (file, directory, feature, commit range, MR) → review that.
- No target named → review current diff (uncommitted changes, or the branch diff against the main branch).

Read the code with workspace tools. When code is supplied inline in the prompt, review what is supplied and read further files only for context.

## Stage 1 — Reviewer

Review target. Collect findings.

### Review algorithm (follow this order)

1. Read project rules — MANDATORY. Read every instruction file covering the reviewed code: root AGENTS.md plus nested ones in the touched directories, and any docs they point to. Project rules override skill rules on conflict
2. Load skills — MANDATORY. Load workspace skills matching the reviewed stack and area (framework, language, UI text, testing). Read their rule files via workspace tools, never from memory
3. Big picture — scan the whole change set for cross-file context
4. Analyze change — split core change vs plumbing. Core design wrong → focus there
5. Full-file context — check the change makes sense: imports used, removed items not referenced, control flow correct
6. API compatibility — check callers match changes
7. Apply skill rules — check violations from this change only, not pre-existing code
8. Apply project rules — check violations of AGENTS.md
9. Deduplicate — skip findings already covered by existing review comments
10. Verify relevance — each finding must fit actual code context (file type, framework, stack), not generic rule mismatch
11. Verify against source — re-read the cited lines. Drop findings referencing code, symbols, imports, or behavior that does not exist in the file. Never describe code from memory or assumption
12. Check the fix — proposed fix must be the smallest change that solves the problem. Drop or rewrite fixes that add abstractions, layers, options, or generalization the problem does not need
13. Keep — only confidence >= 80, reviewed code only, no linter catches or nitpicks. Fix line says WHAT to fix in 1 sentence, not HOW

### Focus on

- Data loss, security holes (XSS, injection, secrets in code)
- Runtime crashes, unhandled errors, null/undefined access
- Broken core logic, wrong conditions, off-by-one errors
- Race conditions, missing await, wrong async handling
- API contract violations, wrong types passed between components
- Functions whose behavior contradicts their name or return type
- Stub or placeholder implementations merged without TODO/FIXME markers
- Public functions where invalid but plausible input gives silently wrong results instead of error
- Unreachable code paths or dead branches caused by change
- New exports or public API surface not consumed anywhere
- Obvious performance pitfalls: O(n²) or worse in loops over collections, sync blocking in async paths, missing pagination on unbounded queries, repeated expensive operations that should be cached or batched
- Hardcoded values that clearly should be configurable or computed (e.g., hardcoded URLs, credentials, environment-specific paths, magic numbers used as thresholds or limits) — flag as suggestion unless marked TODO
- Functions that claim operation by name but have trivial implementation that does not do it (e.g., `isFileExists` returning constant without checking filesystem, `sendEmail` with empty body) — flag unless marked TODO
- Misused dependencies — components, functions, composables or utilities called with wrong arguments, wrong types, ignored return values, missing required props/options, or invoked in way that violates their contract (when signature visible in provided context)
- Reinvented shared utilities — new logic that duplicates existing shared helper/component/composable from project (e.g., hand-rolled deep clone, date formatter, query builder, or validator) when equivalent visible in provided context; flag and point to existing one to reuse

### Do NOT check

Code style, naming, missing comments, test coverage, performance micro-optimizations.

### Finding fields

Track per finding, in your head, not printed at this stage:

- file and line
- title: short, one line
- problem: what is wrong
- fix: what to fix, one sentence
- severity: critical (confidence 90-100) = data loss, security, crash, broken logic. suggestion (confidence 80-89) = everything else
- source: which rule triggered the finding. One of `skill:<skill-name>/<rule-name>`, `repository-rules` (AGENTS.md), `general` (Focus on section)

Source priority when a finding matches several categories: repository-rules > skill > general. Use the highest-priority source that applies.

## Stage 2 — Filter

Act as senior code review editor. Filter findings list. Keep ONLY ones that are:

1. **Real issues** — not false positives, not nitpicks, not style preferences
2. **Actionable** — developer clearly understands what to fix
3. **High confidence** — you agree with finding after review
4. **Critical severity** — NEVER drop findings with severity "critical". May adjust description but must keep in output. Believe critical finding is false positive → downgrade severity to "suggestion" instead of removing.

Remove findings that are:

- Hallucinated — cited line, symbol, or behavior not present in the actual code
- Overengineered fixes — solution heavier than the problem (new abstraction, config, or layer where a local change is enough)
- Duplicates or overlapping with other findings
- Too vague or speculative
- About pre-existing code patterns (not from this change)
- Nitpicks disguised as suggestions
- False positives from incomplete context

For each kept finding, may adjust confidence, severity, or description.

Then pick a verdict: approve, request_changes, or comment.

Verdict rules:

- approve: no findings kept
- request_changes: at least one critical finding
- comment: only suggestions

## Stage 3 — Console report

Do NOT edit, write, or fix any code. This skill only reviews and reports.

Print the kept findings as plain text for a human reading a terminal. No preamble, no closing summary, no extra commentary, only the report below.

Format:

```
Verdict: <verdict> (<N> critical, <M> suggestions)
Reviewed: <what was reviewed>, <K> files

CRITICAL
  <file>:<line>  <title>  [<source>]
    <problem>
    Fix: <fix>

SUGGESTIONS
  <file>:<line>  <title>  [<source>]
    <problem>
    Fix: <fix>
```

Example:

```
Verdict: request_changes (1 critical, 1 suggestion)
Reviewed: uncommitted changes, 3 files

CRITICAL
  apps/api/src/planner/issues.ts:118  Transaction never committed
    The early return on a validation error leaves the transaction open, so the connection leaks.
    Fix: commit or roll back before returning.
    [general]

SUGGESTIONS
  apps/web/src/features/board/Column.tsx:64  Board key hardcoded
    "IAP" is written inline instead of coming from props.
    Fix: take the key from the project prop.
    [repository-rules]
```

Rules:

- Critical findings first, then suggestions. Omit an empty section.
- No findings at all: print only `Verdict: approve (no issues found)` plus the `Reviewed:` line.
- One line per field. Problem and fix stay one sentence each. No paragraphs, no tables, no JSON.
- Source tag in brackets so the reader knows whether it came from project rules, a skill, or built-in checks.
- Sort findings inside a section by file, then by line.
