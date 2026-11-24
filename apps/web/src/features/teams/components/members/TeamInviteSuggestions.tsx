'use client';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useInviteCandidatesQuery } from '@/services/teams.service';
import Avatar from '@/components/common/Avatar';
import { Command, CommandItem, CommandList } from '@/components/ui/command';

export default function TeamInviteSuggestions({
  teamId,
  address,
  onPick,
}: {
  teamId: number;
  address: string;
  onPick: (email: string) => void;
}) {
  const term = useDebouncedValue(address, 300);
  const candidates = useInviteCandidatesQuery(teamId, term).data ?? [];
  const typedOne = candidates.some(
    (person) => person.email.toLowerCase() === address.toLowerCase(),
  );
  if (address.length < 2 || candidates.length === 0 || typedOne) return null;

  return (
    <Command shouldFilter={false} className="h-auto rounded-md border">
      <CommandList>
        {candidates.map((person) => {
          const name = person.name || person.email;
          return (
            <CommandItem
              key={person.userId}
              value={person.userId}
              onSelect={() => onPick(person.email)}
            >
              <Avatar name={name} image={person.image} className="size-6 text-[10px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{person.email}</p>
              </div>
            </CommandItem>
          );
        })}
      </CommandList>
    </Command>
  );
}
