# Web shell and layout

Code: `apps/web/src/components/layout`, `apps/web/src/app/[teamRef]`, `apps/web/src/context/shellContext.ts`.
Commit `42fd2f40`.

## 1. Purpose

The shell wraps every project screen: sidebar, header, project switcher, view tabs,
command palette and overlays. Project modules (dashboards, inbox, work items) render inside it.

## 2. Routes and screens

| Route | File |
| --- | --- |
| `/[teamRef]/[projectKey]` (`(shell)` is a route group, not part of the URL) | `apps/web/src/app/[teamRef]/(shell)/[projectKey]/page.tsx` |
| `.../dashboards`, `.../inbox`, `.../cycles`, `.../initiatives`, `.../docs`, `.../notes`, `.../agents`, `.../mcp`, `.../api`, `.../members`, `.../notifications`, `.../view/[viewId]`, `.../settings/*` | one `page.tsx` each under the same folder |
| `/[teamRef]/settings/*` | `apps/web/src/app/[teamRef]/settings` |
| `/[teamRef]/issue/[identifier]` | `apps/web/src/app/[teamRef]/(shell)/issue/[identifier]/page.tsx` |
| `/issue/[issueId]` | `apps/web/src/app/issue/[issueId]/page.tsx` (a legacy redirect, `LegacyRedirect`) |

`app/` routes stay thin: they mount a feature page and providers only
(`apps/web/AGENTS.md`). The sidebar state is stored in the `sidebar_state` cookie.

## 3. Components

| Component | Role |
| --- | --- |
| `Shell`, `ShellBody`, `ShellOverlays`, `ShellHeaderTitle` | frame, body and overlays of a project screen |
| `AppHeader`, `AppSidebar` | top bar and sidebar |
| `SidebarMainNav`, `SidebarWorkNav`, `SidebarAiTeamNav`, `SidebarConfigNav`, `SidebarSettingsNav` | sidebar sections |
| `ProjectSwitcher*` | project list, recent, starred, search |
| `ViewTabs`, `SavedViewTab`, `AllViewTab`, `DisplayPopover`, `FilterBar` | saved views, display settings and filters |
| `CommandPalette`, `CommandLayer` | command palette over issues, documents and navigation |
| `UserMenu` | account menu |
| `GodShell`, `GodSidebar` | frame for instance-admin pages (`/god`) |

`ShellCtx` (`useShell()`) gives children: `project`, `filteredProject`, `views`, `editor`,
`customFields`, `onOpenIssue`, `onAddIssue`, `onChatWithAgent`. `useShell` throws outside the shell.

### Captured screens

- Project board as the owner: `docs/modules/_shared/screens/owner-project-shell.png`
- Project board as the member: `docs/modules/_shared/screens/member-project-shell.png`
- Command palette as the owner: `docs/modules/_shared/screens/owner-command-palette.png`
- Command palette as the member: `docs/modules/_shared/screens/member-command-palette.png`

Sidebar sections seen: Inbox, Dashboards, Work items, Initiatives, Cycles, Docs, Notes; AI Team
(Runner queue, Schedules, AI Agents); Configuration (Members, API docs, MCP Server).

The command palette opens with Meta+K and has the groups Board (layouts Kanban, Table, Timeline,
Calendar, Select all), Commands, Switch project and Sections. The owner sees 39 options and the member
32. The owner alone sees the commands "New project" and the sections "Actions", "Configuration",
"General", "Import/Export", "Repositories" and "Webhooks".

## 4. API endpoints

Calls observed when the project board opens (project reference `seed-team.SEED`): `GET /projects/:ref`,
`/projects/:ref/issues/board`, `/views`, `/actions/quick`, `/cycles/options`, `/initiatives/options`,
`/notifications/unread` (with and without `projectId`), `/sync/rev?scopes=board:<id>,inbox:<id>`,
`/account/preferences`, `/settings/hotkeys`, `/settings/version`, `/settings/whats-new`, `/teams`,
`/workspaces`, `/projects`. Opening the command palette adds `GET /projects/:ref/documents`, called by
`apps/web/src/components/layout/CommandPaletteDocuments.tsx` through `listDocuments` in
`apps/web/src/lib/api/endpoints/documents.ts`.

On the first sign-in a "What's new" dialog covers the shell; "Got it" sends
`POST /settings/whats-new/seen` (`apps/web/src/lib/api/endpoints/updates.ts`).

The shell calls the paths below (`/views`, `/actions/quick` and similar are under `/projects/:ref`). It loads the project (`lib/api/endpoints/projects.ts`), views
(`lib/api/endpoints/views.ts`) and custom fields (`lib/api/endpoints/customFields.ts`), and the inbox
unread count through `apps/web/src/hooks/useInboxUnread.ts`.

## 5. Database tables

None directly.

## 6. Permissions

`ProjectDetail.viewer` and `ProjectDetail.permissions` come with the project and feed
`usePermissions` (see `web-auth-permissions-i18n.md`).

## 7. Dependencies

`web-ui.md`, `web-data.md`, `web-auth-permissions-i18n.md`, and the hooks `useShellProject`,
`useShellRoute`, `useShellTitle` in `apps/web/src/hooks`.

## 8. Running it in isolation

The shell pulls many hooks and the project, view and custom-field endpoints. A test repo that needs
only one module can skip the shell and render the module's page component inside a minimal
`ShellCtx.Provider` with a project from the API.

## 9. Unconfirmed claims

- The exact minimal `ShellContext` values a module needs are not verified; each module document states them.
- The command palette and sign-in actions were followed from the network capture to the source file by reading the code; `trace_feature` was not used, because it analyses binaries.
- Changing the language was not traced.
- The captures show the dev server's "Compiling" indicator at the bottom left; it is not part of the app.

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
