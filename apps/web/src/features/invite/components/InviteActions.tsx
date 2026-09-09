'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { acceptInvite, rejectInvite } from '@/lib/api/endpoints/invites';
import { ApiError } from '@/lib/api/core/client';
import { projectPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import InviteNotice from './InviteNotice';

// Accept or reject a pending invite when the signed-in session already matches
// the invited email. Accept opens the project it names, or the app root for an
// invite into the team alone; reject re-queries the invite so the page shows the
// declined state.
export default function InviteActions({
  token,
  projectKey,
}: {
  token: string;
  projectKey: string | null;
}) {
  const t = useTranslations('invite');
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);
  // The invitee joined the project before opening the link, so the API refuses to
  // rewrite the membership they already hold. Nothing is left to accept.
  const [alreadyMember, setAlreadyMember] = useState(false);

  async function accept() {
    setError(null);
    setBusy('accept');
    try {
      const result = await acceptInvite(token);
      router.push(result.projectKey ? projectPath(result.projectKey) : '/');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_PROJECT_MEMBER') setAlreadyMember(true);
      else setError(err instanceof Error ? err.message : t('acceptError'));
      setBusy(null);
    }
  }

  async function reject() {
    setError(null);
    setBusy('reject');
    try {
      await rejectInvite(token);
      await qc.invalidateQueries({ queryKey: ['invite', token] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('declineError'));
      setBusy(null);
    }
  }

  if (alreadyMember) {
    return (
      <InviteNotice message={t('alreadyMember')}>
        <Button asChild variant="outline">
          <Link href={projectKey ? projectPath(projectKey) : '/'}>{t('goToProject')}</Link>
        </Button>
      </InviteNotice>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <FieldError>{error}</FieldError>}
      <Button onClick={accept} disabled={busy !== null}>
        {busy === 'accept' ? t('accepting') : t('accept')}
      </Button>
      <Button variant="outline" onClick={reject} disabled={busy !== null}>
        {busy === 'reject' ? t('declining') : t('decline')}
      </Button>
    </div>
  );
}
