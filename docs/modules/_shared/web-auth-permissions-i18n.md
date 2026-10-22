# Web authentication, permissions, i18n and drag and drop

Code: `apps/web/src/lib/auth-client.ts`, `apps/web/src/proxy.ts`, `apps/web/src/hooks/usePermissions.ts`,
`apps/web/src/i18n`, `apps/web/src/lib/dnd.ts`. Commit `42fd2f40`.

## 1. Purpose

How a web screen knows who the user is, what they may do, which language to render, and how lists
are dragged.

## 2. Routes and screens

Sign-in and registration pages: `/login`, `/register`, `/forgot-password`, `/reset-password`,
`/invite/[token]`, `/share/...` under `apps/web/src/app`. `proxy.ts` lets `/login`, `/register`, `/invite`,
`/forgot-password`, `/reset-password`, `/share` and `/media` through, and sends other paths without a
better-auth session cookie to the sign-in page. It also sets the Content-Security-Policy header.

## 3. Components

- `authClient` (`lib/auth-client.ts`): better-auth client with the passkey, API key, magic link,
  OAuth provider and username plugins. Exports `signIn`, `signUp`, `useSession`, `getSession`,
  `signOut` (marks the sign-out so concurrent 401s do not loop), `changePassword`, `updateUser`.
  Its base URL is `<API_URL>/api/auth`.
- `usePermissions(source?)` (`hooks/usePermissions.ts`) returns `can(resource, action)`, `role`,
  `isOwner`, `isAdmin`, `isMember`. `can` is true for the project owner and otherwise reads
  `project.permissions[resource][action]`. `isAdmin` is true for a project owner or a team owner or
  manager.
- i18n: 13 locales (`en`, `uk`, `ru`, `zh-CN`, `zh-TW`, `ar`, `fa`, `fr`, `pt-BR`, `id`, `es-ES`, `ko`, `tr`);
  `ar` and `fa` render right to left. The server reads the `NEXT_LOCALE` cookie, then the
  `Accept-Language` header, then falls back to English (`i18n/request.ts`). Message files are
  `apps/web/messages/<locale>/<namespace>.json`; English is the source. See `docs/dev/i18n.md`.
- `lib/dnd.ts`: `useDndSensors(inert?)` and `DRAG_ACTIVATION_DISTANCE` (4 px) for dnd-kit lists and
  boards; `noDragProps` marks elements that must not start a drag.

### Captured screen and trace

Login page: `docs/modules/_shared/screens/login.png`. Fields: "Email or username", "Password",
button "Sign in", "Sign in with passkey", link "Sign up" to `/register`. Before signing in the page
calls `GET /api/auth/get-session` and `GET /auth-config`. Signing in sends
`POST /api/auth/sign-in/email` (called from `apps/web/src/features/auth/services/auth.service.ts`);
after it the app loads `/teams`, `/workspaces`, `/projects` and `/account/preferences`.

## 4. API endpoints

better-auth endpoints under `/api/auth/*` (sign-in, sign-up, sign-out, session). User preferences,
including language, use `lib/api/endpoints/userPreferences.ts`.

## 5. Database tables

Auth tables are in `packages/db/src/schema/auth.ts`; see `api-data.md`.

## 6. Permissions

The permission resources and actions are defined in `packages/db/src/permissions.ts` and listed in
`api-auth-permissions.md`. The web only reads them from the project response.

## 7. Dependencies

`better-auth` and its plugins, `next-intl`, dnd-kit.

## 8. Running it in isolation

Copy `lib/auth-client.ts`, `lib/api/core/client.ts`, `hooks/usePermissions.ts`, `context/shellContext.ts`
(for `ShellCtx`), the `i18n` folder, `messages`, and `lib/dnd.ts`. The test repo's origin must be accepted by
the API as a trusted origin for better-auth, and the API must run behind a URL whose cookie settings
suit the test repo's origin.

## 9. Unconfirmed claims

- The trusted-origin setting for another web origin is not verified (see `packages/auth/AGENTS.md`).
- Which parts of `lib/dnd.ts` the list and board modules use is stated per module.

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
