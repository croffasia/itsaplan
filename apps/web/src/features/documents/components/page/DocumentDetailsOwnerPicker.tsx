'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Avatar from '@/components/common/Avatar';
import PopoverPick from '@/components/common/fields/PopoverPick';
import { useDocumentAccessCandidates } from '../../services/documents.service';

// Mounted only for whoever may transfer the page, so readers never load the member list.
export default function DocumentDetailsOwnerPicker({
  projectKey,
  ownerId,
  trigger,
  onPick,
}: {
  projectKey: string;
  ownerId: string | null;
  trigger: ReactNode;
  onPick: (userId: string) => void;
}) {
  const t = useTranslations('documents');
  const candidates = useDocumentAccessCandidates(projectKey).data ?? [];
  return (
    <PopoverPick
      trigger={trigger}
      inputPlaceholder={t('inspector.searchMembers')}
      emptyText={t('access.nothingFound')}
      contentClassName="w-64"
      items={candidates
        .filter((person) => person.kind === 'member' && person.canAccess)
        .map((person) => ({
          key: person.userId,
          search: person.name,
          icon: <Avatar name={person.name} image={person.image} />,
          label: person.name,
          selected: person.userId === ownerId,
          onSelect: () => {
            if (person.userId !== ownerId) onPick(person.userId);
          },
        }))}
    />
  );
}
