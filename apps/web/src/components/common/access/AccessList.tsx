'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AccessLabels } from './accessVisibility';

// Who can see a restricted note board or Docs page, for someone who may not change
// it: the owner plus the members granted access, read-only. AccessPicker takes this
// place for whoever may change access.
export default function AccessList({
  trigger,
  ownerUserId,
  memberIds,
  labels,
}: {
  trigger: ReactNode;
  ownerUserId: string | null;
  memberIds: string[];
  labels: AccessLabels;
}) {
  const tCommon = useTranslations('common');
  const { project } = useShell();
  const people = [ownerUserId, ...memberIds]
    .map((userId) => project?.assignees.find((a) => a.userId === userId))
    .filter((a) => a != null);

  return (
    // Modal so a click on a canvas that swallows pointer events still dismisses the
    // popover.
    <Popover modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">{labels.access}</p>
          <p className="text-xs text-muted-foreground">{labels.listHint}</p>
        </div>
        <ul className="p-1">
          {people.map((person) => (
            <li
              key={person.userId}
              className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              <Avatar name={person.name} image={person.image} className="size-6 text-[10px]" />
              <span className="truncate">{person.name}</span>
              {(person.userId === ownerUserId || person.kind === 'agent') && (
                <Badge variant="secondary" className="ms-auto px-1.5 py-0 text-[10px]">
                  {person.userId === ownerUserId ? tCommon('owner') : labels.agent}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
