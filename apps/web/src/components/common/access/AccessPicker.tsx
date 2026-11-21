'use client';

import { useState, type ReactNode } from 'react';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import PopoverPick, { type PickItem } from '@/components/common/fields/PopoverPick';
import {
  ACCESS_ICON,
  type AccessCandidate,
  type AccessLabels,
  type AccessVisibility,
} from './accessVisibility';

const MODES: AccessVisibility[] = ['public', 'private', 'restricted'];

// The access control of a note board or a Docs page: a picker of the three states
// plus, for a restricted one, who is granted access. The host shows it only to
// whoever may change access.
export default function AccessPicker({
  trigger,
  visibility,
  memberIds,
  candidates,
  labels,
  busy = false,
  onChange,
}: {
  trigger: ReactNode;
  visibility: AccessVisibility;
  memberIds: string[];
  candidates: AccessCandidate[] | undefined;
  labels: AccessLabels;
  // A change is being saved, and the host takes one at a time: nothing can be picked.
  busy?: boolean;
  onChange: (visibility: AccessVisibility, memberIds?: string[]) => void;
}) {
  const { data: session } = useSession();
  // What the picker shows, which is not always the saved state: picking
  // "restricted" only reveals the member list, since nothing is saved as restricted
  // until someone is granted access.
  const [mode, setMode] = useState<AccessVisibility>(visibility);

  const people = (candidates ?? []).filter((c) => c.userId !== session?.user.id);

  function pickMode(next: AccessVisibility) {
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
    const Icon = ACCESS_ICON[m];
    return {
      key: m,
      search: labels.visibility[m],
      icon: <Icon className="size-4" />,
      label: labels.visibility[m],
      selected: m === mode,
      disabled: busy,
      onSelect: () => pickMode(m),
    };
  });

  function toItem(candidate: AccessCandidate): PickItem {
    const selected = memberIds.includes(candidate.userId);
    return {
      key: candidate.userId,
      search: candidate.name,
      icon: <Avatar name={candidate.name} image={candidate.image} className="size-4 text-[8px]" />,
      label: candidate.name,
      selected,
      trailing: candidate.canAccess ? undefined : (
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {labels.noAccess}
        </Badge>
      ),
      // Granting access to someone whose role cannot read the feature changes
      // nothing, so the API rejects it. One already granted stays clickable — that
      // is how their access is taken away after a role change.
      disabled: busy || (!candidate.canAccess && !selected),
      onSelect: () => toggleMember(candidate.userId),
    };
  }

  const groups =
    mode === 'restricted'
      ? [
          { heading: labels.members, items: people.filter((c) => c.kind === 'member').map(toItem) },
          { heading: labels.agents, items: people.filter((c) => c.kind === 'agent').map(toItem) },
        ]
      : [];

  return (
    <PopoverPick
      trigger={trigger}
      inputPlaceholder={labels.placeholder}
      emptyText={labels.nothingFound}
      items={modeItems}
      groups={groups}
      closeOnSelect={false}
      align="end"
      contentClassName="w-72"
      modal
    />
  );
}
