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
  FieldSeparator,
} from '@/components/ui/field';
import AuthFormHeader from '../AuthFormHeader';
import AuthMessagePanel from '../AuthMessagePanel';
import AuthRegisterPasswordFields from './AuthRegisterPasswordFields';
import AuthRegisterProviders from './AuthRegisterProviders';
import {
  signInWithGoogle,
  signInWithOidc,
  signOutUnverified,
  signUpWithEmail,
} from '../../services/auth.service';
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
  // With the password form off, the identity provider is what creates the account,
  // so this screen keeps only the buttons that start that round trip.
  const passwordEnabled = authConfig?.emailPassword !== false;
  const hasProvider = authConfig?.oidc === true || authConfig?.google === true;

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

  function subtitle() {
    if (!passwordEnabled) return t('register.subtitleSso');
    if (inviteOnly) return t('register.subtitleInviteOnly');
    return t('register.subtitle');
  }

  return (
    <form onSubmit={onSubmit} className="p-6 md:p-8">
      <FieldGroup>
        <AuthFormHeader title={t('register.title')} description={subtitle()} />

        {passwordEnabled && (
          <>
            <AuthRegisterPasswordFields
              email={email}
              password={password}
              confirm={confirm}
              pending={pending}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirm}
            />

            {error && <FieldError>{error}</FieldError>}

            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? t('register.submitPending') : t('register.submit')}
              </Button>
            </Field>
          </>
        )}

        {hasProvider && (
          <>
            {passwordEnabled && <FieldSeparator>{t('register.or')}</FieldSeparator>}
            <AuthRegisterProviders
              pending={pending}
              onOidc={() => run(signInWithOidc, { redirect: false })}
              onGoogle={() => run(signInWithGoogle, { redirect: false })}
            />
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
