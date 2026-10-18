---
name: itsaplan-route-to-feature-move
description: Use when moving app/ route components into src/features/.
category: frontend
---

# Moving route components into a feature

- `app/<route>/page.tsx` keeps only `generateMetadata` and mounts one feature component (for example `<Product />` from `@/features/product/Product`). Sections live in `src/features/<name>/components/`.
- Move untracked files with plain `mv`. `git mv` fails with `fatal: source directory is empty` on untracked folders.
- Rewrite moved imports (`./_components/X` to `./components/X`, `../links` to the new path). Run `grep -rn "<old path>"` across `apps/web/src` to find other importers.
- Run prettier on the moved folder, then `bun --filter=web run typecheck` and `bun --filter=web run build`. Check the boundary rules in `web-feature-import-boundaries`.
