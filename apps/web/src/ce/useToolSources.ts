'use client';

import { useTranslations } from 'next-intl';
import type { ToolSourceEntry } from '@/features/teams/types/toolSource';

// A self-hosted instance defines no tools of its own; a locked entry says what the
// editions that do bring. The hosted build returns its own sources.
export default function useToolSources(): ToolSourceEntry[] {
  const t = useTranslations('teams.tools');
  return [{ kind: 'locked', key: 'http', label: t('ownTool'), hint: t('ownToolHint') }];
}
