# web (Next.js)

Next.js App Router. Pages server-render, API data loads in the browser. Tailwind v4 + shadcn/ui.

## Imports

- Imports within the same feature are relative (`./`, `../`). The shared layer and other features
  use the `@/` alias.
- A feature imports the shared layer (`@/utils`, `@/lib`, `@/hooks`, `@/context`, `@/services`,
  `@/i18n`, `@/components/*`), never another feature. One accepted one-way exception: `work-items`
  may compose `issue` components. A second such need moves the piece to `components/common`.
- The shared layer never imports a feature. `app/` pages stay thin: mount the feature page and
  providers, or redirect.

## Feature structure

- **One component per file, no exceptions.** On finding a file with two, split it. File name =
  exported name, with the feature name as a PascalCase prefix.
- Split a component past ~120 lines or one that mixes layout, fetch, mutation and dialog.
- A feature's parts go in `components/`, `hooks/`, `context/`, `services/`, `utils/`, even when a
  folder holds one file. A React context and its `use*` reader go in `context/`. The feature root
  holds only entry components, one per page. No `pages/` folder.
- A feature with more than two pages gets one `components/<page>/` subfolder per page that has
  parts of its own. A part used by two pages goes in `components/` or `components/shared/`.
- Types live next to the code that produces them. A `types/` file is only for a shape with no
  single owner. Service files carry a `.service.ts` suffix.
- A part used by one feature stays in it. Promote it to the shared layer only when a second
  feature needs it.
- `src/lib` holds wrappers over external packages and the API client. `src/utils` holds own
  helpers with no external package behind them. `components/common` groups by purpose; imports of
  a sibling in the same folder are relative.

## Translations

next-intl, language from the `NEXT_LOCALE` cookie, then `Accept-Language`, no `[locale]` route
segment. Files are `messages/<locale>/<namespace>.json`; namespaces are domains, not pages.
`docs/dev/i18n.md` has the whole picture, including how to add a language.

- A new namespace needs its file in every language plus an entry in `coreMessages`.
- Do not subset messages with `pick()`: a missing namespace then fails at runtime.
- Angle brackets in a message are rich-text tags. Write `owner/repo`, not `<owner>/<repo>`.
- The layout mirrors for right-to-left languages. In new code use logical utilities (`ms`/`me`,
  `ps`/`pe`, `start`/`end`, `border-s`/`border-e`, `text-start`/`text-end`), not `ml-`, `left-` or
  `text-left`. A `left-1/2` centring pair stays physical: `translate-x` has no logical form.
- Content that is not prose sits in a `dir="ltr"` container. User-written text gets `dir="auto"`.

## Rules

- Read API data in the browser with the react-query hooks in `services/`. `lib/api` sends the
  browser cookie, so a server render cannot read as the user.
- A screen names itself in the browser tab with `useDocumentTitle`; a server-rendered page renders
  `components/common/DocumentTitle`. Never set `metadata.title` per route.
- A screen that has to stay live calls `useLiveRefresh({ scope, targets })` with a scope from
  `@/utils/revScopes`. Never its own polling.
- A paged list holds its window in `usePaging()` and renders `ListPager`. A filter change calls
  `reset()`.
- A "show more" list over a `Page<T>` route uses `useInfiniteQuery` with
  `getNextPageParam: nextPageParam` (`useCompletedCyclesQuery` is the shape to copy). A cursor
  route passes its own `nextCursor` or `nextPage`.
- A picker that needs every row calls a whole-list route (`/options` on a paged list), never a
  paged one with a large `pageSize`.
- The API client: `lib/api/core/` holds the transport, `mediaUrl` and the paging helpers,
  `lib/api/endpoints/` one flat file per domain, named after the module or sub-resource of
  `apps/api/src/modules` it calls, with its DTOs beside the functions.
- No `index.ts` or barrel under `lib/api`. Types cross domains with `import type`.
- A type named like a DOM global (`Permissions`, `Notification`) resolves to that global when its
  import is missing, and tsc fails only on a DTO-only field, so import it explicitly.
- Nothing per-instance may reach the bundle: the image serves every instance. New config of that
  kind goes in `utils/runtimeEnv`. Never `process.env.NEXT_PUBLIC_*` in a component.
- Avatars and attachments render from `/media/...` through `mediaUrl`, document assets from
  `/protected-media/...`. Both are on the web origin, never an absolute api url.
- **Every write tells the user how it went.** A failed `useMutation` is toasted by the
  `MutationCache`, so its call site adds nothing for the failure. A plain request or a better-auth
  call toasts its own.
- A call site adds `toast.success(...)` from `onSuccess` or after `await mutateAsync`, with a
  translated message, unless the screen already shows the result.
- A mutation that renders its own error sets `meta: { suppressErrorToast: true }`.
- **A reader gets values, not disabled controls.** When the user may not change a setting, render
  its state (icon plus word) instead of a disabled switch, input or button, and say once who can
  change it. Reuse `components/common/fields/OnOffStatus.tsx` for an on/off state.
- When a switch that gates a section is off, drop the section.
- A workspace's owner and admins reach its projects and teams without being members: the project
  or team carries `via: 'workspace'`. In a project `usePermissions().isMember` is false; a team
  screen reads `team.via`.
- For those users, leave out starring and hiding a project, saving a private view, leaving the
  project or the team, and notification settings. Everything else follows `can()`.
- Add shadcn components with `bunx shadcn@latest add <name>`.
- **Do not edit `src/components/ui/`.** Re-adding a component overwrites it. Style from outside:
  a rule in `globals.css` on `[data-slot='…']`, outside `@layer`, since anything in
  `@layer components` loses to utility classes. Prefer a prop the component exposes.
- After a re-add, re-apply the local edits. `chart.tsx`: `debounce` on `ResponsiveContainer`, or a
  chart in a resizing container loops until "Maximum update depth exceeded", and the `sized` gate.
- Local edits in other components: `sidebar.tsx` (translated labels, `isTypingTarget` on Ctrl+B),
  `calendar.tsx` (`useDateFnsLocale`), `command.tsx` and `message-scroller.tsx` (translated labels).
- Tailwind v4: no `tailwind.config`. Tokens are in `src/app/globals.css`.
- Do not remove `output: "standalone"` + `outputFileTracingRoot` from `next.config`: the Docker
  image depends on them.
- Guard `localStorage`/`window` in a render path with `typeof window === 'undefined'`. Client
  components still server-render. Read a stored value that reaches the markup in an effect, or the
  first client render does not match the server markup.
