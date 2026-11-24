'use client';

import { UserPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DocumentAccessCandidate } from '@/lib/api/endpoints/documents';
import { useShell } from '@/context/shellContext';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { Pill } from '@/components/common/fields/Pill';
import PopoverPick, { type PickItem } from '@/components/common/fields/PopoverPick';
import { Button } from '@/components/ui/button';
import { useDocumentAccessCandidates } from '../../services/documents.service';

// The people a page is shared with, and the picker that adds or removes them.
export default function DocumentAccessPeople({
  projectKey,
  memberIds,
  disabled,
  open,
  onOpenChange,
  onChange,
}: {
  projectKey: string;
  memberIds: string[];
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (memberIds: string[]) => void;
}) {
  const t = useTranslations('documents');
  const { data: session } = useSession();
  const { project } = useShell();
  const { data: candidates } = useDocumentAccessCandidates(projectKey);
  const chosen = memberIds
    .map((userId) => project?.assignees.find((a) => a.userId === userId))
    .filter((person) => person != null);

  function toggle(userId: string) {
    onChange(
      memberIds.includes(userId) ? memberIds.filter((id) => id !== userId) : [...memberIds, userId],
    );
  }

  function toItem(candidate: DocumentAccessCandidate): PickItem {
    const selected = memberIds.includes(candidate.userId);
    return {
      key: candidate.userId,
      search: candidate.name,
      icon: <Avatar name={candidate.name} image={candidate.image} className="size-4 text-[8px]" />,
      label: candidate.name,
      selected,
      trailing: candidate.canAccess ? undefined : (
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {t('access.noAccess')}
        </span>
      ),
      tooltip: candidate.canAccess ? undefined : t('access.roleCannotOpen'),
      // The API refuses someone whose role cannot read Docs. One already added stays
      // clickable, so they can still be removed after a role change.
      disabled: disabled || (!candidate.canAccess && !selected),
      onSelect: () => toggle(candidate.userId),
    };
  }

  // The viewer owns the page and always has access. The API sends members only.
  const people = (candidates ?? []).filter((c) => c.userId !== session?.user.id);

  return (
    <div className="ms-7 mt-0.5 mb-1.5 flex flex-col items-start gap-1">
      <PopoverPick
        open={open}
        onOpenChange={onOpenChange}
        trigger={
          <Pill disabled={disabled}>
            <UserPlus />
            <span className="truncate">{t('access.addPeople')}</span>
          </Pill>
        }
        inputPlaceholder={t('access.searchPeople')}
        emptyText={t('access.nothingFound')}
        groups={[{ heading: t('access.members'), items: people.map(toItem) }]}
        closeOnSelect={false}
        contentClassName="w-[280px]"
      />
      {chosen.length > 0 && (
        <ul className="max-h-60 w-full overflow-y-auto overscroll-contain">
          {chosen.map((person) => (
            <li key={person.userId} className="group flex min-h-9 items-center gap-2.5 text-sm">
              <Avatar name={person.name} image={person.image} />
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {person.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={t('access.remove', { name: person.name })}
                title={t('access.remove', { name: person.name })}
                className="size-6.5 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                onClick={() => toggle(person.userId)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
