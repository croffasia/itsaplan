'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import AuthFormHeader from '../AuthFormHeader';
import AuthMessagePanel from '../AuthMessagePanel';
import AuthRegisterProviders from '../AuthRegisterProviders';
import {
  sendPasswordResetEmail,
  signInWithGoogle,
  signInWithOidc,
} from '../../services/auth.service';
import { useAuthAction } from '../../hooks/useAuthAction';
import { useAuthConfig } from '@/services/authConfig.service';

// Asks for the address and mails a reset link. The answer is the same whether or not
// an account exists, so this screen never tells the visitor which it was.
export default function AuthForgotPasswordForm() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { error, pending, run } = useAuthAction();
  // The api mails no reset link while the password form is off: the identity provider
  // holds the password then.
  const passwordEnabled = useAuthConfig()?.emailPassword !== false;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    run(
      async () => {
        await sendPasswordResetEmail(email);
        setSent(true);
      },
      { redirect: false },
    );
  }

  if (sent) {
    return (
      <AuthMessagePanel
        title={t('forgotPassword.sentTitle')}
        description={t('forgotPassword.sentDescription', { email })}
        footer={
          <Link href="/login" className="underline underline-offset-4">
            {t('forgotPassword.backToSignIn')}
          </Link>
        }
      />
    );
  }

  if (!passwordEnabled) {
    return (
      <div className="p-6 md:p-8">
        <FieldGroup>
          <AuthFormHeader
            title={t('forgotPassword.title')}
            description={t('forgotPassword.subtitleSso')}
          />

          <AuthRegisterProviders
            pending={pending}
            onOidc={() => run(signInWithOidc, { redirect: false })}
            onGoogle={() => run(signInWithGoogle, { redirect: false })}
          />

          {error && <FieldError>{error}</FieldError>}

          <FieldDescription className="text-center">
            {t('forgotPassword.remembered')}{' '}
            <Link href="/login" className="underline underline-offset-4">
              {t('forgotPassword.signIn')}
            </Link>
          </FieldDescription>
        </FieldGroup>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader
          title={t('forgotPassword.title')}
          description={t('forgotPassword.subtitle')}
        />

        <Field>
          <FieldLabel htmlFor="email">{t('fields.email')}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder={t('fields.emailPlaceholder')}
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? t('forgotPassword.submitPending') : t('forgotPassword.submit')}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          {t('forgotPassword.remembered')}{' '}
          <Link href="/login" className="underline underline-offset-4">
            {t('forgotPassword.signIn')}
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
