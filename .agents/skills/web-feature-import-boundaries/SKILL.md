---
name: web-feature-import-boundaries
description: Use when a web feature imports another feature folder.
category: frontend
---

# Web feature import boundaries

A feature under `apps/web/src/features/<name>` does not import from another feature folder. The one exception is work-items importing from issue.

- Shared UI goes to `apps/web/src/components/common/<name>/`, as governance did with `components/common/agent-actions`.
- Shared API clients go to `apps/web/src/services/`.
- A setting that belongs to one domain (for example team integrations) goes to that domain's feature, such as `features/teams`.
- When moving a file, update every importer in the same change and delete the emptied feature folder.
- Before deleting the folder, remove stray `.claude/autoharness` lock files inside it, then run `grep -rn "features/<name>"` over `apps/web/src` to confirm no importer is left.
