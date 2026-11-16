'use client';

import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { Team } from '@/lib/api/endpoints/teams';
import { useCreateTeam } from '@/services/teams.service';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { TEAM_SLUG_PATTERN, suggestTeamSlug } from '../utils/teamSlug';

// Creates a team with the current user as its owner. Name and URL slug only: everything
// else a team carries (its members, its projects) is added afterwards. `onCreated` is where
// the caller takes it from there — the teams page opens the new team.
export default function NewTeamModal({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: number;
  onClose: () => void;
  onCreated?: (team: Team) => void;
}) {
  const t = useTranslations('teams.create');
  const createTeam = useCreateTeam();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  // The slug follows the name until the user edits it; clearing it resumes that.
  const [slugEdited, setSlugEdited] = useState(false);
  // An empty field is reported only after a submit, not while the form is being filled.
  const [submitted, setSubmitted] = useState(false);

  const slugValid = TEAM_SLUG_PATTERN.test(slug);
  const nameError = submitted && name.trim() === '';
  const slugError = (submitted || slug !== '') && !slugValid;
  // The modal opens on a click, so it never renders on the server.
  const host = typeof window === 'undefined' ? '' : window.location.host;

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
    setSubmitted(true);
    if (createTeam.isPending || name.trim() === '' || !slugValid) return;
    createTeam.mutate(
      { name: name.trim(), slug, workspaceId },
      {
        onSuccess: (team) => {
          onClose();
          onCreated?.(team);
        },
      },
    );
  }

  function submitOnEnter(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
  }

  return (
    <Modal title={t('title')} onClose={onClose} className="pb-3">
      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-team-name">{t('name')}</Label>
          <Input
            id="new-team-name"
            dir={name ? 'auto' : undefined}
            value={name}
            aria-invalid={nameError}
            aria-describedby={nameError ? 'new-team-name-error' : undefined}
            onChange={(e) => changeName(e.target.value)}
            onKeyDown={submitOnEnter}
            autoFocus
          />
          {nameError && (
            <p id="new-team-name-error" className="text-xs text-destructive">
              {t('nameRequired')}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-team-slug">{t('slug')}</Label>
          <InputGroup dir="ltr" className="overflow-hidden">
            <InputGroupAddon className="self-stretch border-e bg-muted pe-3 font-normal">
              {host}/
            </InputGroupAddon>
            <InputGroupInput
              id="new-team-slug"
              value={slug}
              placeholder="acme"
              aria-invalid={slugError}
              aria-describedby={slugError ? 'new-team-slug-error' : undefined}
              onChange={(e) => changeSlug(e.target.value)}
              onKeyDown={submitOnEnter}
            />
          </InputGroup>
          {slugError && (
            <p id="new-team-slug-error" className="text-xs text-destructive">
              {t('slugInvalid')}
            </p>
          )}
        </div>

        <div className="flex items-center border-t pt-3">
          <Button className="ms-auto" disabled={createTeam.isPending} onClick={submit}>
            {t('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
