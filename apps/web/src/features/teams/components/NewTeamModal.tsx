'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api/endpoints/teams';
import { useCreateTeam } from '@/services/teams.service';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';

// Creates a team with the current user as its owner. Name only: everything else a
// team carries (its members, its projects) is added afterwards. `onCreated` is where
// the caller takes it from there — the teams page opens the new team.
export default function NewTeamModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (team: Team) => void;
}) {
  const t = useTranslations('teams.create');
  const createTeam = useCreateTeam();
  const [name, setName] = useState('');

  const canSubmit = !createTeam.isPending && name.trim() !== '';

  function submit() {
    if (!canSubmit) return;
    createTeam.mutate(
      { name: name.trim() },
      {
        onSuccess: (team) => {
          onClose();
          onCreated?.(team);
        },
      },
    );
  }

  return (
    <Modal title={t('title')} onClose={onClose} className="pb-3">
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
            <Users className="size-5" />
          </div>
          <input
            dir={name ? 'auto' : undefined}
            className="w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
            placeholder={t('namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
            }}
            autoFocus
          />
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{t('hint')}</p>

        <div className="mt-4 flex items-center border-t pt-3">
          <Button className="ms-auto" disabled={!canSubmit} onClick={submit}>
            {t('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
