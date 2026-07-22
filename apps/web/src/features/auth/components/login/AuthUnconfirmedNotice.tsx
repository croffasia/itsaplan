'use client';

import { FieldDescription } from '@/components/ui/field';

// Shown when a sign-in was refused because the address is still unconfirmed: point at
// the spam folder, and offer to send the confirmation link again.
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
  return (
    <FieldDescription className="text-center">
      {resent ? (
        'Confirmation email sent. Check your inbox, and your spam folder.'
      ) : (
        <>
          Check your spam folder, or{' '}
          <button
            type="button"
            className="underline underline-offset-4"
            disabled={pending || !canResend}
            onClick={onResend}
          >
            send a new confirmation email
          </button>
          .
        </>
      )}
    </FieldDescription>
  );
}
