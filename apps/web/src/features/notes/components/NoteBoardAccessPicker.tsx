'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { NoteBoardAccessCandidate, NoteBoardVisibility } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import PopoverPick, { type PickItem } from '@/components/common/fields/PopoverPick';
import { useNoteBoardAccessCandidates } from '../services/noteBoards.service';
import { VISIBILITY_ICON } from '../utils/visibility';

const MODES: NoteBoardVisibility[] = ['public', 'private', 'restricted'];

// The board access control on the canvas: the state icon, opening a picker of the
// three states plus, for a restricted board, who is granted access. Only the board
// creator gets it (the host decides).
export default function NoteBoardAccessPicker({
  projectKey,
  visibility,
  memberIds,
  onChange,
}: {
  projectKey: string;
  visibility: NoteBoardVisibility;
  memberIds: string[];
  onChange: (visibility: NoteBoardVisibility, memberIds?: string[]) => void;
}) {
  const { data: session } = useSession();
  const { data: candidates } = useNoteBoardAccessCandidates(projectKey);
  // What the picker shows, which is not always the saved state: picking
  // "restricted" only reveals the member list, since a board with no one granted
  // access is saved as private.
  const [mode, setMode] = useState<NoteBoardVisibility>(visibility);
  const t = useTranslations('notes');

  const people = (candidates ?? []).filter((c) => c.userId !== session?.user.id);

  function pickMode(next: NoteBoardVisibility) {
    setMode(next);
    if (next !== 'restricted') onChange(next);
  }

  function toggleMember(userId: string) {
    const next = memberIds.includes(userId)
      ? memberIds.filter((id) => id !== userId)
      : [...memberIds, userId];
    onChange('restricted', next);
  }

  const modeItems: PickItem[] = MODES.map((m) => {
    const Icon = VISIBILITY_ICON[m];
    return {
      key: m,
      search: t(`visibility.${m}`),
      icon: <Icon className="size-4" />,
      label: t(`visibility.${m}`),
      selected: m === mode,
      onSelect: () => pickMode(m),
    };
  });

  function toItem(candidate: NoteBoardAccessCandidate): PickItem {
    const selected = memberIds.includes(candidate.userId);
    return {
      key: candidate.userId,
      search: candidate.name,
      icon: <Avatar name={candidate.name} image={candidate.image} className="size-4 text-[8px]" />,
      label: candidate.name,
      selected,
      trailing: candidate.canAccess ? undefined : (
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {t('noAccessShort')}
        </Badge>
      ),
      // Granting access to someone whose role cannot read notes changes nothing, so
      // the API rejects it. One already granted stays clickable — that is how their
      // access is taken away after a role change.
      disabled: !candidate.canAccess && !selected,
      onSelect: () => toggleMember(candidate.userId),
    };
  }

  const groups =
    mode === 'restricted'
      ? [
          { heading: t('members'), items: people.filter((c) => c.kind === 'member').map(toItem) },
          { heading: t('agents'), items: people.filter((c) => c.kind === 'agent').map(toItem) },
        ]
      : [];

  const Icon = VISIBILITY_ICON[visibility];

  return (
    <PopoverPick
      trigger={
        <button
          type="button"
          aria-label={t('boardAccess')}
          title={t(`visibilityHint.${visibility}`)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Icon className="size-3.5" />
        </button>
      }
      inputPlaceholder={t('boardAccessPlaceholder')}
      emptyText={t('nothingFound')}
      items={modeItems}
      groups={groups}
      closeOnSelect={false}
      align="end"
      contentClassName="w-72"
      modal
    />
  );
}
