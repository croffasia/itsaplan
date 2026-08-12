'use client';

import { useTranslations } from 'next-intl';
import type { EffectFieldKey } from '@/utils/actions';
import { usePriorityLabel } from '@/hooks/usePriorityLabel';

// Names the fields of an action effect and the values that stand for "nothing
// set", so the effect helpers stay plain functions the messages are passed into.
export interface EffectText {
  field: (key: EffectFieldKey) => string;
  cleared: string;
  noAssignee: string;
  noType: string;
  noLabels: string;
  priority: (value: string | null) => string;
}

const FIELD_MESSAGES = {
  columnId: 'state',
  assigneeUserId: 'assignee',
  priority: 'priority',
  typeId: 'type',
  startDate: 'startDate',
  dueDate: 'dueDate',
  labelIds: 'labels',
} as const;

export function useEffectText(): EffectText {
  const tFields = useTranslations('issue.fields');
  const t = useTranslations('issue.effects');
  const priority = usePriorityLabel();

  return {
    field: (key) => tFields(FIELD_MESSAGES[key]),
    cleared: t('cleared'),
    noAssignee: t('noAssignee'),
    noType: t('noType'),
    noLabels: t('noLabels'),
    priority,
  };
}
