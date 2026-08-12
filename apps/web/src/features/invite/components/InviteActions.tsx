'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { projectPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';

// Accept or reject a pending invite when the signed-in session already matches
// the invited email. Accept opens the project; reject re-queries the invite so
// the page shows the declined state.
export default function InviteActions({ token }: { token: string }) {
  const t = useTranslations('invite');
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'accept' | 'reject' | null>(null);

  async function accept() {
    setError(null);
    setBusy('accept');
    try {
      const result = await api.acceptInvite(token);
      router.push(projectPath(result.projectKey));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('acceptError'));
      setBusy(null);
    }
  }

  async function reject() {
    setError(null);
    setBusy('reject');
    try {
      await api.rejectInvite(token);
      await qc.invalidateQueries({ queryKey: ['invite', token] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('declineError'));
      setBusy(null);
    }
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
