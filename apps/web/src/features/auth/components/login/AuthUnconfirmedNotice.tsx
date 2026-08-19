'use client';

import { useTranslations } from 'next-intl';
import { FieldDescription } from '@/components/ui/field';

// Shown when a sign-in was refused because the address is still unconfirmed: point at
// the spam folder, and offer to send the confirmation link again. A sign-in by
// username gives no address to send to, so that case asks for one instead.
export default function AuthUnconfirmedNotice({
  resent,
  pending,
  canResend,
  onResend,
}: {
  resent: boolean;
  pending: boolean;
  canResend: boolean;
  onResend: () => void;
}) {
  const t = useTranslations('auth.login');

  return (
    <FieldDescription className="text-center">
      {resent && t('unconfirmedResent')}
      {!resent && !canResend && t('unconfirmedNeedsEmail')}
      {!resent &&
        canResend &&
        t.rich('unconfirmedPrompt', {
          resend: (chunks) => (
            <button
              type="button"
              className="underline underline-offset-4"
              disabled={pending}
              onClick={onResend}
            >
              {chunks}
            </button>
          ),
        })}
    </FieldDescription>
  );
}
