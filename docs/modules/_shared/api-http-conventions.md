# API HTTP conventions

Code: `apps/api/src/shared/{http,responses,pagination,schemas}.ts`, `apps/api/src/app.ts`,
`apps/api/AGENTS.md`. Commit `42fd2f40`.

## 1. Purpose

How API modules are laid out and what every endpoint returns on failure and on a paged list.

## 2. Routes and screens

None.

## 3. Components

- Module layout: `apps/api/src/modules/<feature>/{index,model,service}.ts` (controller, request and
  response schemas, Drizzle functions). `src/app.ts` assembles the app and exports `app` and the type
  `App` for the Eden Treaty client. Imports across folders use the aliases `#shared/*`, `#mcp/*`,
  `#modules/*`, `#tests/*`.
- `HttpError(status, message, code?)` in `apps/api/src/shared/lib.ts`: a handler throws it and the
  `onError` handler in `apps/api/src/planner.ts` answers `{ error, code? }` with that status. The same
  handler turns a Postgres unique violation into 409, a request-body validation failure into 400, and
  any other error into 500 (logged).
- `errors(...codes)`, `accessErrors` (401, 403, 404) and `commonErrors` (400, 401, 403, 404) in
  `shared/responses.ts`.
- `paginate`, `pageQueryFields`, `pageResponse` in `shared/pagination.ts`.
- `noContent`, `sseResponse`, `sseFrame` in `shared/http.ts` (204 and server-sent events).

## 4. API endpoints

Error body (confirmed): `{"error": "<message>", "code": "<optional>"}`. Example, `GET
/projects/NOPE/issues` as the owner: 404 `{"error":"Project 'NOPE' not found"}`. Status codes in use: 400, 401, 403, 404, 409, 413, 500, 502.

Paged list (confirmed): query `page` (1-based, default 1) and `pageSize` (1 to 100, default 25);
response `{ "items": [...], "total": n, "page": n, "pageSize": n }`. `GET /teams/:teamId/projects`
is paged. Not every list is paged: `GET /projects/:projectKey/issues` and `GET /teams` answer a plain
array.

Delete answers 204 with no body (`DELETE /dashboards/:id`, confirmed).

## 5. Database tables

None.

## 6. Permissions

See `api-auth-permissions.md`.

## 7. Dependencies

Elysia (`t` schemas), Drizzle.

## 8. Running it in isolation

Clients send JSON with `Content-Type: application/json`, the session cookie, and an `Origin` header
the API trusts. The web client wraps this in `request<T>` (see `web-data.md`).

## 9. Unconfirmed claims

- The code for the 400 validation error body is not captured here.
- Which list endpoints are paged is checked per module.
