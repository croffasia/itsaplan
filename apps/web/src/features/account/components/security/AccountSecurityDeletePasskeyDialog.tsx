'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { passkey } from '@/lib/auth-client';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { passkeyLabel } from '../../utils/authenticators';
import type { PasskeyRow } from '../../services/passkeys.service';

export default function AccountSecurityDeletePasskeyDialog({
  passkey: target,
  accountEmail,
  onClose,
  onDeleted,
}: {
  passkey: PasskeyRow;
  accountEmail?: string;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const t = useTranslations('account.security');
  return (
    <ConfirmDialog
      title={t('removePasskeyTitle')}
      confirmLabel={t('removePasskey')}
      onClose={onClose}
      onConfirm={async () => {
        // Passkey delete is a better-auth call, not a React Query mutation, so the
        // global error toast does not cover it — toast the failure here, then throw
        // to keep the dialog open.
        const result = await passkey.deletePasskey({ id: target.id });
        if (result?.error) {
          const message = result.error.message ?? t('removePasskeyFailed');
          toast.error(message);
          throw new Error(message);
        }
        await onDeleted();
      }}
    >
      <p className="text-sm">
        <span className="font-medium text-foreground">
          {passkeyLabel(target, t('passkeyFallback'))}
        </span>
        {accountEmail && <span className="text-muted-foreground"> · {accountEmail}</span>}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{t('deleteWarning')}</p>
    </ConfirmDialog>
  );
}
