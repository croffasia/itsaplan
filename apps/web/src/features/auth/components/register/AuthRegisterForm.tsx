'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import GoogleIcon from '@/components/common/GoogleIcon';
import AuthFormHeader from '../AuthFormHeader';
import AuthMessagePanel from '../AuthMessagePanel';
import { signInWithGoogle, signOutUnverified, signUpWithEmail } from '../../services/auth.service';
import { useAuthAction } from '../../hooks/useAuthAction';
import { useAuthConfig } from '@/services/authConfig.service';

export default function AuthRegisterForm() {
  const t = useTranslations('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const { error, pending, setError, run } = useAuthAction();
  const authConfig = useAuthConfig();
  const inviteOnly = authConfig?.registration === 'invite';
  const needsConfirmation = authConfig?.requireEmailVerification === true;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t('errors.passwordsDoNotMatch'));
      return;
    }
    // With confirmation required, sign-up still opens a session (autoSignIn), so it
    // is dropped right away: the account exists but stays unusable until the link in
    // the email is opened.
    if (needsConfirmation) {
      run(
        async () => {
          await signUpWithEmail({ email, password });
          await signOutUnverified();
          setAwaitingConfirmation(true);
        },
        { redirect: false },
      );
      return;
    }
    run(() => signUpWithEmail({ email, password }));
  }

  if (awaitingConfirmation) {
    return (
      <AuthMessagePanel
        title={t('register.confirmTitle')}
        description={t('register.confirmDescription', { email })}
        footer={
          <Link href="/login" className="underline underline-offset-4">
            {t('register.backToSignIn')}
          </Link>
        }
      />
    );
  }

  // Registration closed: the form has nothing to submit to. Invite-only still shows
  // the form — an invited address can sign up here, and the API rejects the rest.
  if (authConfig?.registration === 'closed') {
    return (
      <AuthMessagePanel
        title={t('register.closedTitle')}
        description={t('register.closedDescription')}
        footer={
          <>
            {t('register.haveAccount')}{' '}
            <Link href="/login" className="underline underline-offset-4">
              {t('register.signIn')}
            </Link>
          </>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader
          title={t('register.title')}
          description={inviteOnly ? t('register.subtitleInviteOnly') : t('register.subtitle')}
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

        <Field>
          <FieldLabel htmlFor="password">{t('fields.password')}</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            onChange={(e) => setConfirm(e.target.value)}
            disabled={pending}
          />
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <Field>
          <Button type="submit" disabled={pending}>
            {pending ? t('register.submitPending') : t('register.submit')}
          </Button>
        </Field>

        {/* Google covers sign-up too: an address without an account gets one, subject
            to the same registration mode as the form above. */}
        {authConfig?.google && (
          <>
            <FieldSeparator>{t('register.or')}</FieldSeparator>
            <Field>
              <Button
                type="button"
                variant="outline"
                onClick={() => run(signInWithGoogle, { redirect: false })}
                disabled={pending}
              >
                <GoogleIcon className="size-4" />
                {t('register.withGoogle')}
              </Button>
            </Field>
          </>
        )}

        <FieldDescription className="text-center">
          {t('register.haveAccount')}{' '}
          <Link href="/login" className="underline underline-offset-4">
            {t('register.signIn')}
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
