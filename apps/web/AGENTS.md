# web (Next.js) — rules

Next.js App Router, SSR (not SPA). Tailwind v4 + shadcn/ui. See root `AGENTS.md`.

## Imports

- A feature is a self-contained module: imports **within the same feature** use relative paths
  (`./`, `../`); imports of the **shared layer or another feature** use the `@/` alias.
- A feature imports the shared layer (`@/utils`, `@/lib`, `@/hooks`, `@/context`, `@/services`,
  `@/components/*`), never another feature —
  one accepted one-way exception: `work-items` may compose `issue` presentational components. Keep it
  one-directional, no cycles; if a second such need appears, move the shared piece to
  `components/common`.
- The shared layer never imports a feature. `app/` routes stay thin: mount the feature page and
  providers only.

## Feature structure & decomposition

- **One component per file — no exceptions.** A file exports exactly one component, even when the
  extra one is three lines long. On finding a file with two, split it: each component moves to its
  own file named after it, and the imports are updated.
- Keep components small and single-purpose. Split when one grows past ~120 lines or mixes concerns
  (layout + fetch + mutation + dialog). The entry component becomes a thin composition; each part
  is its own file. Push state to where it is used; the parent holds only what it coordinates.
- A feature's own parts go in purpose folders: `components/`, `hooks/`, `context/`, `services/`,
  `utils/`. Split by purpose even when a folder holds one file. A React context and its `use*`
  reader go in `context/`, not `hooks/`. The feature root holds only the entry
  component (named after the feature) — no `pages/` folder (routing is `src/app/`).
- **A feature with more than two pages groups its components by page.** `components/` gets one
  subfolder per page, named after that page (`components/profile/`, `components/security/`), and
  each page's parts go in its own folder. A component used by two or more of the feature's pages
  stays directly in `components/`. A feature with one or two pages keeps `components/` flat.
- Types live next to the code that produces them (API-response type in its service, prop type in
  its component), not in a `types/` folder. Add a `types/` file only for a standalone shape shared
  by several modules with no single owner.
- Shared vs local decides feature-folder vs `src/`: a part used by more than one feature goes to
  the shared layer (`src/utils`, `src/lib`, `src/hooks`, `src/context`, `src/services`,
  `components/{common,ui}`); a part used by one feature stays in it. Promote only when a second
  feature needs it (YAGNI) — don't pre-share.
- The shared layer splits by what a module depends on: `src/lib` holds wrappers over external
  packages (`api.ts`, `auth-client.ts`, `markdown.ts`, `dnd.ts`) plus shadcn's `utils.ts` (`cn`,
  fixed by `components.json`); `src/utils` holds own helpers and constants with no external
  package behind them. `src/context` holds shared React contexts and their `use*` readers.
- `components/common` groups by purpose: `agent-chat/`, `fields/`, `inputs/`, `page/`, `overlay/`,
  `permissions/`, `hotkeys/`. A component that fits none of them stays at the `common/` root.
  Imports of a sibling in the same folder are relative; everything else uses `@/`.
- Component files use the feature name as a PascalCase prefix, file name = exported name. Service
  files carry a `.service.ts` suffix (`passkeys.service.ts`). Other non-component files use plain
  descriptive names (the folder gives the context).

## Rules

- Prefer Server Components and server-side data fetching; reach for client components only for
  interactivity/hooks.
- Call the backend over HTTP at the API origin. `lib/api.ts` reads `NEXT_PUBLIC_API_URL`
  from `apps/web/.env` (same value as the root `API_URL`), inlined at build time.
- Add shadcn components with `bunx shadcn@latest add <name>` (config in `components.json`).
- Tailwind v4: no `tailwind.config`; tokens live in `src/app/globals.css` (`@theme`, CSS vars).
- `NEXT_PUBLIC_*` are build-time — set them in `apps/web/.env` before `next build`, or as
  web Dockerfile build args.
- Don't remove `output: "standalone"` + `outputFileTracingRoot` from `next.config` — the Docker
  image depends on them.
- When touching `localStorage`/`window` in a render path (e.g. a `useState` initializer), guard
  with `typeof window === 'undefined'` — client components still server-render.
