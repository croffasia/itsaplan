'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api/endpoints/teams';
import { useCreateTeam } from '@/services/teams.service';
import { cn } from '@/lib/utils';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TEAM_SLUG_PATTERN, suggestTeamSlug } from '../utils/teamSlug';

// Creates a team with the current user as its owner. Name and URL slug only: everything
// else a team carries (its members, its projects) is added afterwards. `onCreated` is where
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
  const [slug, setSlug] = useState('');
  // The slug follows the name until the user edits it; clearing it resumes that.
  const [slugEdited, setSlugEdited] = useState(false);

  const slugValid = TEAM_SLUG_PATTERN.test(slug);
  const slugError = slug !== '' && !slugValid;
  const canSubmit = !createTeam.isPending && name.trim() !== '' && slugValid;

  function changeName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(suggestTeamSlug(value));
  }

  function changeSlug(value: string) {
    const next = value.toLowerCase().trim();
    setSlug(next);
    setSlugEdited(next !== '');
  }

  function submit() {
    if (!canSubmit) return;
    createTeam.mutate(
      { name: name.trim(), slug },
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
            onChange={(e) => changeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
            }}
            autoFocus
          />
        </div>

        <div className="mt-4 space-y-1.5">
          <Label htmlFor="new-team-slug">{t('slug')}</Label>
          <Input
            id="new-team-slug"
            value={slug}
            placeholder="acme"
            dir="ltr"
            aria-invalid={slugError}
            aria-describedby="new-team-slug-hint"
            onChange={(e) => changeSlug(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
            }}
          />
          <p
            id="new-team-slug-hint"
            className={cn('text-xs', slugError ? 'text-destructive' : 'text-muted-foreground')}
          >
            {slugError ? t('slugInvalid') : t('slugHint')}
          </p>
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
