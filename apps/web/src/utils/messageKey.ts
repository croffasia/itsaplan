import type { useTranslations } from 'next-intl';

// A translator read as a plain string lookup. Message keys are typed against the
// English catalogue (see global.d.ts), which cannot express a key composed from a
// runtime value — a section slug, a field name, a layout id. Reading through this
// gives up that check for those lookups only.
export function byKey(t: ReturnType<typeof useTranslations>) {
  return t as unknown as (key: string, values?: Record<string, string | number>) => string;
}
