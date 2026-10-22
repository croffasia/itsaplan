# Shared layer

Commit `42fd2f40`. Documents that every module document depends on.

| Document | Covers |
| --- | --- |
| [web-ui.md](web-ui.md) | `components/ui`, `components/common` |
| [web-shell.md](web-shell.md) | `components/layout`, the project shell and its routes |
| [web-data.md](web-data.md) | `lib/api`, `services`, providers, runtime environment |
| [web-auth-permissions-i18n.md](web-auth-permissions-i18n.md) | auth client, permissions hook, i18n, drag and drop |
| [api-auth-permissions.md](api-auth-permissions.md) | session, guards, permission matrix |
| [api-http-conventions.md](api-http-conventions.md) | module layout, errors, pagination |
| [api-data.md](api-data.md) | tables by area, migrations |
| [seed/README.md](seed/README.md) | seed data for captures |
| `check-docs.ts` | `bun docs/modules/_shared/check-docs.ts` checks mapping coverage and cited paths |
