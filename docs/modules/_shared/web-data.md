# Web data layer

Code: `apps/web/src/lib/api`, `apps/web/src/services`, `apps/web/src/components/providers.tsx`,
`apps/web/src/utils/runtimeEnv.ts`. Commit `42fd2f40`.

## 1. Purpose

The web app never imports server packages. It calls the API over HTTP with the session cookie. Three
layers:

1. `lib/api/core/client.ts`: `request<T>(path, init)`, `uploadFile`, `ApiError`, `API_URL`.
2. `lib/api/endpoints/*.ts`: one file per API domain; typed functions such as `listDashboards(projectKey)`.
3. `services/*.service.ts`: TanStack Query hooks over the endpoint functions, such as
   `useDashboardsQuery`, with cache keys from `services/queryKeys.ts` (`qk`).

## 2. Routes and screens

None.

## 3. Components

`components/providers.tsx` exports `Providers`: a `QueryClient` (stale time 15 s, refetch on window
focus, 1 retry), a toast for every failed mutation (opt out with `meta: { suppressErrorToast: true }`),
and the hotkeys, sync, relative-time, session-scope and preferences-sync providers.

## 4. API endpoints

Behaviour of `request`: sends `credentials: 'include'` and `cache: 'no-store'`; a non-2xx response throws
`ApiError(status, message, code)` where `message` is the API's `{ error }` text; 204 returns
`undefined`; a 401 signs the user out once and goes to `/login?expired=1`.

`API_URL` is read at runtime from the server process (`utils/runtimeEnv.ts`, `window.__ITSAPLAN_ENV__`),
not at build time. A missing `API_URL` throws at import.

Endpoint files in `apps/web/src/lib/api/endpoints`: actions, activity, agentAnalytics, agentChat,
agentSchedules, agentSkills, agentTools, agents, analytics, attachments, checklists, columns,
connectedApps, customFields, cycles, dashboards, documents, git, god, importExport, imports, initiatives,
integrations, invites, issueTemplates, issueTypes, issues, labels, link-previews, members, modelPrices,
noteBoards, notificationPreferences, notificationSettings, notifications, projects, roles,
runnerQueue, settings, share, sync, teams, telegram, updates, userPreferences, views, webhooks,
worklogs, workspaces. Most files match an API module of a similar name. Some do not: checklists and worklogs are served by the `issues` module, and activity, agentChat, agentSchedules, agentSkills, agentTools, integrations, modelPrices, updates and runnerQueue have no module of the same name. The module documents state the controller behind each file.

## 5. Database tables

None.

## 6. Permissions

Handled by the API; the client only reacts to 401 and 403. UI gating is in
`web-auth-permissions-i18n.md`.

## 7. Dependencies

`@tanstack/react-query`, `next-intl`, `sonner`, `radix-ui`.

## 8. Running it in isolation

A test repo copies `apps/web/src/lib/api/core`, the endpoint files for the domains it uses,
`apps/web/src/services/queryKeys.ts`, the matching `services/*.service.ts`,
`apps/web/src/utils/runtimeEnv.ts`, `apps/web/src/components/runtime-env-script.tsx` (rendered in `apps/web/src/app/layout.tsx`; it writes `window.__ITSAPLAN_ENV__`, and without it the browser reads an empty `API_URL` and `lib/api/core/client.ts` throws at import), and `Providers`. Set `API_URL` to the API origin, and make the API
allow the test repo's origin for cookies and CORS (`APP_URL` on the API side).

## 9. Unconfirmed claims

- Which endpoint file corresponds to which API controller is by name only; it is checked per module.
- The CORS and cookie settings needed for a different web origin are not verified.

## REA evidence

Captured on 2026-10-21 against the local instance with the seed accounts, in headless Chrome
(1280 x 720). Four captures, exported as one bundle (sha256
`d1529194cc17d7ae905311317fee8dd955e5aec0c46062cf60d4b9320a56a8e3`, 4 records, 0 unknowns):

| Capture | Evidence id |
| --- | --- |
| Login page | `ev_37f4fc1c1076a9be236da39fbce51f0bd73571fdd920103771f9c56f3939f28b` |
| Owner sign-in, first screen (What's new dialog open) | `ev_29f598cc616e3a44b1269c3b20982430248f5ce4753503fa67bc6394e0efa9be` |
| Owner: dismiss the dialog, open project, open command palette | `ev_8b5974fee6fbfee98fbf120f87d554a1241bb0503540a6b5b7dafb3d1ee64053` |
| Member: same steps | `ev_ce8ebc19aaf2287bce26c168e7e3dae53c3d377e6e8ac2c1dd404d62f144924e` |

The bundle file is not in the repo. Screenshots are in `docs/modules/_shared/screens`.
