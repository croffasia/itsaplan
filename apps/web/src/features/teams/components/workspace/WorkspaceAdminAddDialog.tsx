'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  useAddWorkspaceAdmin,
  useWorkspaceManagerCandidatesQuery,
} from '@/services/workspaces.service';
import Avatar from '@/components/common/Avatar';
import Modal from '@/components/common/overlay/Modal';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

// Picks a person from the workspace's teams to make its admin. The search runs on the
// server, which answers with up to 20 people.
export default function WorkspaceAdminAddDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: number;
  onClose: () => void;
}) {
  const t = useTranslations('teams.workspace.managers');
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 300);
  const candidates = useWorkspaceManagerCandidatesQuery(workspaceId, term).data ?? [];
  const add = useAddWorkspaceAdmin(workspaceId);

  async function pick(userId: string, name: string) {
    await add.mutateAsync(userId);
    toast.success(t('added', { name }));
    onClose();
  }

  return (
    <Modal title={t('addTitle')} description={t('addDescription')} onClose={onClose}>
      <Command shouldFilter={false} className="rounded-md border">
        <CommandInput value={search} onValueChange={setSearch} placeholder={t('search')} />
        <CommandList>
          <CommandEmpty>{t('noCandidates')}</CommandEmpty>
          {candidates.map((person) => {
            const name = person.name || person.email;
            return (
              <CommandItem
                key={person.userId}
                value={person.userId}
                disabled={add.isPending}
                onSelect={() => void pick(person.userId, name)}
              >
                <Avatar name={name} image={person.image} className="size-6 text-[10px]" />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{person.email}</span>
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>
    </Modal>
  );
}
