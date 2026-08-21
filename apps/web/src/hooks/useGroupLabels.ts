'use client';

import { useTranslations } from 'next-intl';
import type { GroupLabels } from '@/utils/project';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';

// The names buildGroups needs beyond the project's own entities: the "No …" group
// of each nullable grouping field, and the priority values.
export function useGroupLabels(): GroupLabels {
  const t = useTranslations('workItems.groups');
  const priority = usePriorityLabel();
  return {
    noAssignee: t('noAssignee'),
    noDelegate: t('noDelegate'),
    noPriority: t('noPriority'),
    noType: t('noType'),
    noInitiative: t('noInitiative'),
    noCycle: t('noCycle'),
    noMember: t('noMember'),
    priority,
  };
}
