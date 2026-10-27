'use client';

import { useTranslations } from 'next-intl';
import type { ImportSourceEntry } from '@/features/settings/types/importSource';

// A self-hosted instance imports from the core's sources, and a last tab says where
// more are. The hosted build returns the core's with its own added at any position.
export default function useImportSources(core: ImportSourceEntry[]): ImportSourceEntry[] {
  const t = useTranslations('settings.importExport');
  return [
    ...core,
    { kind: 'more', key: 'more', label: t('moreSources'), hint: t('moreSourcesHint') },
  ];
}
