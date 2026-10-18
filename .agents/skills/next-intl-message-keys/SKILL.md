---
name: next-intl-message-keys
description: Use when adding next-intl message keys or translations.
category: frontend
---

# next-intl message keys

Add the key to `apps/web/messages/en/<namespace>.json` first, then to every other locale folder with a real translation. A key missing from any locale fails `bun run lint`.

1. Read the Translations section of `apps/web/AGENTS.md` before editing.
2. Add the key in `en`. `src/i18n/messages.ts` types every `t('…')` from English, so typecheck fails until it exists.
3. Add the same key path to each other locale: ar, es-ES, fr, id, ko, pt-BR, ru, uk, zh-CN. Translate the text. Do not copy the English.
4. Nest related keys under one object (for example `hero.plansOnTrack`) and read them with `useTranslations('<namespace>')`.
5. Write the JSON with 2-space indent and `ensure_ascii=False`, then run `bunx prettier --write` on the touched files.
6. Do not put locale-formatted numbers or dates in a message. Pass the value through `useFormatter()` (`format.number`, `format.dateTime`).
7. Angle brackets in a message are rich-text tags. Write `owner/repo`, not `<owner>/<repo>`.
8. Verify from the repo root: `bun --filter=web run typecheck` and `bun run lint`. The lint rule `eslint-plugin-i18n-json` checks identical key sets across locales and ICU parsing.
