'use client';

import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VISIBILITY_ICON } from '../utils/visibility';

// Who can see a restricted board, for someone who may not change it: the owner
// plus the members granted access, read-only. The picker (NoteBoardAccessPicker)
// takes this place for the board creator.
export default function NoteBoardAccessList({
  ownerUserId,
  memberIds,
}: {
  ownerUserId: string | null;
  memberIds: string[];
}) {
  const t = useTranslations('notes');
  const tCommon = useTranslations('common');
  const { project } = useShell();
  const people = [ownerUserId, ...memberIds]
    .map((userId) => project?.assignees.find((a) => a.userId === userId))
    .filter((a) => a != null);

  const Icon = VISIBILITY_ICON.restricted;

  return (
    // Modal so a click on the React Flow canvas, which swallows pointer events,
    // still dismisses the popover.
    <Popover modal>
      <PopoverTrigger
        aria-label={t('boardAccess')}
        className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Icon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-medium">{t('boardAccess')}</p>
          <p className="text-xs text-muted-foreground">{t('accessHint')}</p>
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
                <Badge variant="secondary" className="ml-auto px-1.5 py-0 text-[10px]">
                  {person.userId === ownerUserId ? tCommon('owner') : t('agent')}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
