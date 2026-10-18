---
name: itsaplan-product-rename-scope
description: Use when renaming the product or its UI copy and app name.
category: tooling
---

# itsaplan product rename scope

Change user-visible product strings only. Keep identifiers that deploys or installs depend on.

- Keep unchanged: package names (`@itsaplan/runner` on npm), GHCR image names (`ghcr.io/croffasia/itsaplan-<service>`), domains, database names, and env variable names.
- Change in visible copy: UI messages, emails, passkey display name, and the `messages/*` locale files.
- Fix prose references in comments, docs, and READMEs.
- Leave legal text (`ICLA.md`, `cla.yml`) unchanged. It names the agreement's project owner; changing a signed agreement needs the owner's decision.
- After the change, run the format check, lint, and typecheck, then the api and worker suites.
