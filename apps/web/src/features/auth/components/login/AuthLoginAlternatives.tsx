'use client';

import { KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import GoogleIcon from '@/components/common/GoogleIcon';
import { useAuthConfig } from '@/services/authConfig.service';

// The sign-in methods that are not the email + password form: the magic link toggle,
// the instance's own OIDC provider, Google, and passkeys. Which of the first three
// show depends on the instance config.
export default function AuthLoginAlternatives({
  signingInWithLink,
  pending,
  onToggleMethod,
  onOidc,
  onGoogle,
  onPasskey,
}: {
  signingInWithLink: boolean;
  pending: boolean;
  onToggleMethod: () => void;
  onOidc: () => void;
  onGoogle: () => void;
  onPasskey: () => void;
}) {
  const t = useTranslations('auth.login');
  const authConfig = useAuthConfig();
  // With the password form off there is no method to toggle away from, so the magic
  // link button would offer a screen the API refuses.
  const passwordEnabled = authConfig?.emailPassword !== false;

  // One Field for all of them so they sit together as a group — a Field each would
  // space them like separate form questions. Tighter than the default field gap:
  // they are one stack of choices, not separate answers.
  return (
    <Field className="gap-2">
      {authConfig?.magicLink && passwordEnabled && (
        <Button type="button" variant="outline" disabled={pending} onClick={onToggleMethod}>
          {signingInWithLink ? <Lock /> : <Mail />}
          {signingInWithLink ? t('withPassword') : t('withLink')}
        </Button>
      )}
      {authConfig?.oidc && (
        <Button type="button" variant="outline" onClick={onOidc} disabled={pending}>
          <ShieldCheck />
          {/* The operator named their own identity provider, so the label is shown
              as given rather than translated. */}
          {authConfig.oidcLabel || t('withSso')}
        </Button>
      )}
      {authConfig?.google && (
        <Button type="button" variant="outline" onClick={onGoogle} disabled={pending}>
          <GoogleIcon className="size-4" />
          {t('withGoogle')}
        </Button>
      )}
      <Button type="button" variant="outline" onClick={onPasskey} disabled={pending}>
        <KeyRound />
        {t('withPasskey')}
      </Button>
    </Field>
  );
}
