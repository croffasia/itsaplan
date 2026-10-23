'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { passkey, useSession } from '@/lib/auth-client';
import { APP_NAME } from '@/utils/app';
import { Button } from '@/components/ui/button';
import { useRefusalMessage } from '@/hooks/useRefusalMessage';
import AccountSecurityConfirmSession from './AccountSecurityConfirmSession';

export default function AccountSecurityAddPasskey({ onAdded }: { onAdded: () => void }) {
  const t = useTranslations('account.security');
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const refusalMessage = useRefusalMessage();

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t('notSignedIn'));
      // The name becomes the WebAuthn userName shown in the OS/browser picker.
      const result = await passkey.addPasskey({ name: `${APP_NAME} · ${session.user.email}` });
      if (result?.error) throw result.error;
    },
    onSuccess: () => {
      setConfirmed(false);
      onAdded();
    },
    onError: (err) => {
      if ('code' in err && err.code === 'SESSION_NOT_FRESH') {
        setConfirmed(false);
        setConfirming(true);
        return;
      }
      setError(refusalMessage(err, t('addPasskeyFailed')));
    },
    meta: { suppressErrorToast: true },
  });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => {
          setError(null);
          addMutation.mutate();
        }}
        disabled={addMutation.isPending}
      >
        <Plus className="size-3.5" />
        {addMutation.isPending ? t('waitingForPasskey') : t('addPasskey')}
      </Button>
      {confirmed && (
        <p role="status" className="max-w-40 text-end text-sm text-muted-foreground">
          {t('sessionConfirmed')}
        </p>
      )}
      {error && (
        <p role="alert" className="max-w-40 text-end text-xs text-destructive">
          {error}
        </p>
      )}
      {confirming && session && (
        <AccountSecurityConfirmSession
          userId={session.user.id}
          email={session.user.email}
          onClose={() => setConfirming(false)}
          onConfirmed={() => {
            setConfirming(false);
            setConfirmed(true);
          }}
        />
      )}
    </div>
  );
}
