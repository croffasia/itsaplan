'use client';

import { useTranslations } from 'next-intl';
import type { MemberKind } from '@/lib/api/endpoints/members';
import { EmptyState } from '@/components/common/page/EmptyState';

export default function MembersEmptyState({
  kind,
  searching,
}: {
  kind: MemberKind;
  searching: boolean;
}) {
  const t = useTranslations('members.empty');

  if (searching) {
    return <EmptyState title={t('search.title')} description={t(`search.${kind}`)} />;
  }

  return <EmptyState title={t(`${kind}.title`)} description={t(`${kind}.description`)} />;
}
