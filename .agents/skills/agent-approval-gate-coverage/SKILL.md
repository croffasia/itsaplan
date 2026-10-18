---
name: agent-approval-gate-coverage
description: Use when adding an agent tool that changes state.
category: backend
---

# Agent approval gate coverage

When an agent has require-approval on, every tool call that changes state holds for approval. A tool path that skips the gate is a bug, even if it is not a built-in route tool.

- Pass the approval argument to every tool builder the runtime calls, including `buildCustomTools`, not only `buildRouteTools`.
- A non-read-only tool call stores an `agent_pending_action` row (tool `custom:<key>:<id>`) and runs on approve through the same runtime path.
- The integration tool catalog has no read-only flag, so every custom integration call is held, including reads. Add a read-only flag to the catalog before letting any read run at once, and state the choice in the UI copy and the docs.
- Approval claims the pending row as `applying` before the call runs, then writes `approved` or `failed` with the result. Never write `approved` without a result; a row left in `applying` is shown for a person to inspect.
- On approve, re-resolve the tool and its credential from the agent's current bindings. If the tool was removed since the hold, fail the approval.
- Add an integration test that the held call does not run before approval.
