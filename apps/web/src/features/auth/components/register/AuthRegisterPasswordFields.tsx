'use client';

import { useTranslations } from 'next-intl';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

// The address and the two password fields. They are the whole email/password sign-up,
// so an instance that runs off its identity provider leaves them out entirely.
export default function AuthRegisterPasswordFields({
  email,
  password,
  confirm,
  pending,
  onEmailChange,
  onPasswordChange,
  onConfirmChange,
}: {
  email: string;
  password: string;
  confirm: string;
  pending: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
}) {
  const t = useTranslations('auth');

  return (
    <>
      <Field>
        <FieldLabel htmlFor="email">{t('fields.email')}</FieldLabel>
        <Input
          id="email"
          type="email"
          placeholder={t('fields.emailPlaceholder')}
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={pending}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="password">{t('fields.password')}</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          disabled={pending}
        />
        <FieldDescription>{t('fields.passwordHint')}</FieldDescription>
      </Field>

      <Field>
        <FieldLabel htmlFor="confirm-password">{t('fields.confirmPassword')}</FieldLabel>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
          disabled={pending}
        />
      </Field>
    </>
  );
}
