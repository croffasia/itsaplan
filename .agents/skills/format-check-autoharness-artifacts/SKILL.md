---
name: format-check-autoharness-artifacts
description: Use when format:check fails on autoharness .claude JSON.
category: tooling
---

# format:check failures on autoharness artifacts

Files under `.claude/autoharness/` (`last_run.json`, `runs/*.json`, `intents/*`, `requests`) are runtime output of the autoharness hooks. They are untracked and not kept formatted. When `format:check` lists only these paths, the failure is not caused by your change.

- Do not run `prettier --write` on them and do not stage them.
- Prove your own files pass: `bunx prettier --check <your files>`.
- Report the foreign paths and the non-zero exit of `format:check` in the final report, with the paths listed.
- Ignoring `.claude/autoharness/` in `.prettierignore` is a repo change. Propose it in the report; do not make it unless asked.
