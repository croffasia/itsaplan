---
name: api-per-user-rate-limit
description: Use when adding a per-user 429 rate limit to an api route.
category: backend
---

# API per-user rate limit

Limit a costly route with a small helper inside the owning module that throws `HttpError(429, ...)`. Add a shared helper only when a second module needs the same limit.

- Keep a sliding window in `modules/<name>/rate-limit.ts`: a `Map<userId, number[]>` of call times, and an exported limit constant so tests do not hard-code it.
- Call the helper in the handler after `requireUser(user)` and before the paid or model call. Add `429` to that route's `response` map with `errors(...)`.
- Limit only calls that spend resources. Routes that write without a model call stay unlimited.
- Note in the module's `AGENTS.md` that the count is per process, so with several replicas a user can exceed the limit in total.
- Test by calling the route exactly the limit's number of times, then asserting the next call returns 429. Code shape is in `references/limiter-shape.md`.
