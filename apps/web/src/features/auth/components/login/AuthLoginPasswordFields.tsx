'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuthConfig } from '@/services/authConfig.service';

// The identifier and password pair. With a password the identifier is an address or
// a username; a sign-in link can only go to an address, so the password field drops
// away and the label changes with it.
export default function AuthLoginPasswordFields({
  signingInWithLink,
  identifier,
  password,
  pending,
  onIdentifierChange,
  onPasswordChange,
}: {
  signingInWithLink: boolean;
  identifier: string;
  password: string;
  pending: boolean;
  onIdentifierChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
}) {
  const t = useTranslations('auth');
  const authConfig = useAuthConfig();

  return (
    <>
      <Field>
        <FieldLabel htmlFor="identifier">
          {signingInWithLink ? t('fields.email') : t('fields.identifier')}
        </FieldLabel>
        <Input
          id="identifier"
          type={signingInWithLink ? 'email' : 'text'}
          placeholder={t('fields.emailPlaceholder')}
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => onIdentifierChange(e.target.value)}
          disabled={pending}
        />
      </Field>

      {!signingInWithLink && (
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">{t('fields.password')}</FieldLabel>
            {authConfig?.emailEnabled && (
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {t('login.forgotPassword')}
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            disabled={pending}
          />
        </Field>
      )}
    </>
  );
}
