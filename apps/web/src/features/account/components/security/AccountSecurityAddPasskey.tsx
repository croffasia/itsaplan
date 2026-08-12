'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { passkey, useSession } from '@/lib/auth-client';
import { APP_NAME } from '@/utils/app';
import { Button } from '@/components/ui/button';

export default function AccountSecurityAddPasskey({ onAdded }: { onAdded: () => void }) {
  const t = useTranslations('account.security');
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error(t('notSignedIn'));
      // The name becomes the WebAuthn userName shown in the OS/browser picker.
      const result = await passkey.addPasskey({ name: `${APP_NAME} · ${session.user.email}` });
      if (result?.error) throw new Error(result.error.message ?? t('addPasskeyFailed'));
    },
    onSuccess: onAdded,
    onError: (err) => setError(err instanceof Error ? err.message : t('addPasskeyFailed')),
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
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
