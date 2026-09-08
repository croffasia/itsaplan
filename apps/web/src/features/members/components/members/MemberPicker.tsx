'use client';

import { useState } from 'react';
import { Check, ChevronDown, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MemberCandidate } from '@/lib/api/endpoints/members';
import Avatar from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import MemberAgentBadge from './MemberAgentBadge';

// Who the dialog is about to put in the project: someone already in the team, or an
// address that gets an invite.
export type MemberOption =
  { kind: 'member'; candidate: MemberCandidate } | { kind: 'invite'; email: string };

function optionLabel(option: MemberOption): string {
  return option.kind === 'member' ? option.candidate.name || option.candidate.email : option.email;
}

// Who to add: the picked person on the field, and a search over the team members the
// project does not have yet in the list it opens, plus an invite row for a typed
// address none of them carries.
export default function MemberPicker({
  candidates,
  value,
  onChange,
  query,
  onQueryChange,
  invite,
  canAdd,
  canInvite,
  disabled,
}: {
  candidates: MemberCandidate[];
  value: MemberOption | null;
  onChange: (option: MemberOption) => void;
  query: string;
  onQueryChange: (value: string) => void;
  // The typed address when it names nobody in the team, otherwise null. `pending`
  // means the project already invited it, so it is listed rather than offered.
  invite: { email: string; pending: boolean } | null;
  canAdd: boolean;
  canInvite: boolean;
  disabled: boolean;
}) {
  const t = useTranslations('members.add');
  const [open, setOpen] = useState(false);
  const picked = value?.kind === 'member' ? value.candidate.userId : null;

  function pick(option: MemberOption) {
    onChange(option);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-9 w-full justify-between rounded-full border-input bg-input/20 px-3 font-normal hover:bg-input/50 dark:bg-input/30 dark:hover:bg-input/50"
        >
          <span className={value ? 'truncate' : 'truncate text-muted-foreground'}>
            {value ? optionLabel(value) : t('pickPlaceholder')}
          </span>
          <ChevronDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput
            placeholder={canInvite ? t('searchPlaceholder') : t('searchTeamPlaceholder')}
            value={query}
            onValueChange={onQueryChange}
          />
          <CommandList className="max-h-56">
            <CommandEmpty>{canInvite ? t('typeEmail') : t('noCandidates')}</CommandEmpty>
            {canAdd && (
              <CommandGroup heading={t('fromTeam')}>
                {candidates.map((candidate) => (
                  <CommandItem
                    key={candidate.userId}
                    value={`${candidate.name} ${candidate.email}`}
                    onSelect={() => pick({ kind: 'member', candidate })}
                    className="gap-2.5 py-2"
                  >
                    <Avatar
                      name={candidate.name || candidate.email}
                      image={candidate.image}
                      className="size-7 shrink-0 text-[10px]"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{candidate.name || candidate.email}</span>
                      {!candidate.isAgent && (
                        <span className="truncate text-xs text-muted-foreground">
                          {candidate.email}
                        </span>
                      )}
                    </div>
                    {candidate.isAgent && <MemberAgentBadge />}
                    {picked === candidate.userId && <Check className="size-4 shrink-0" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {invite && (
              <CommandGroup heading={t('byEmail')}>
                <CommandItem
                  value={invite.email}
                  disabled={invite.pending}
                  onSelect={() => pick({ kind: 'invite', email: invite.email })}
                >
                  <Mail className="size-4 text-muted-foreground" />
                  {invite.pending
                    ? t('alreadyInvited', { email: invite.email })
                    : t('inviteEmail', { email: invite.email })}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
