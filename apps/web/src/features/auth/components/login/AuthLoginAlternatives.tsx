'use client';

import { KeyRound, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import GoogleIcon from '@/components/common/GoogleIcon';
import { useAuthConfig } from '@/services/authConfig.service';

// The sign-in methods that are not the email + password form: the magic link toggle,
// Google, and passkeys. Which of the first two show depends on the instance config.
export default function AuthLoginAlternatives({
  signingInWithLink,
  pending,
  onToggleMethod,
  onGoogle,
  onPasskey,
}: {
  signingInWithLink: boolean;
  pending: boolean;
  onToggleMethod: () => void;
  onGoogle: () => void;
  onPasskey: () => void;
}) {
  const authConfig = useAuthConfig();

  // One Field for all of them so they sit together as a group — a Field each would
  // space them like separate form questions. Tighter than the default field gap:
  // they are one stack of choices, not separate answers.
  return (
    <Field className="gap-2">
      {authConfig?.magicLink && (
        <Button type="button" variant="outline" disabled={pending} onClick={onToggleMethod}>
          {signingInWithLink ? <Lock /> : <Mail />}
          {signingInWithLink ? 'Sign in with a password' : 'Email me a sign-in link'}
        </Button>
      )}
      {authConfig?.google && (
        <Button type="button" variant="outline" onClick={onGoogle} disabled={pending}>
          <GoogleIcon className="size-4" />
          Continue with Google
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onPasskey} disabled={pending}>
        <KeyRound />
        Sign in with passkey
      </Button>
    </Field>
  );
}
