'use client';

import { useTranslations } from 'next-intl';
import type { IssueLinkInputKind } from '@/lib/api';

// How one issue relates to another, named for the reader. Used wherever a
// relation is listed: the issue detail panel, the board cards, the table and the
// timeline sub-rows.
export function useLinkRelationLabel() {
  const t = useTranslations('issueLinks.relations');
  return (relation: IssueLinkInputKind) => t(relation);
}
